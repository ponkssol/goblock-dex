import { PublicKey } from "@solana/web3.js";
import { NextRequest, NextResponse } from "next/server";
import { skillMarkdown } from "@goblock/shared/skill";
import { formatAtomic, formatImpact, toAtomic } from "@goblock/shared/units";
import { allowSwap, recordUse, requireKey, type KeyPlan } from "./access";
import { quoteBest } from "./best";
import { freeKeyFee } from "./fees";
import { loadUsdPrice } from "./market";
import { ensureOperator } from "./operator";
import type { SwapQuote } from "./quote";
import { connection } from "./rpc";
import { searchTokens, type ListedToken } from "./token-directory";
import { SOL, SOL_MINT, USDC, isMint } from "./tokens";

const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"] as const;
const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const TOKEN_2022 = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, accept, x-api-key, mcp-protocol-version, mcp-session-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "mcp-session-id",
};

export const TOOLS = [
  "search_tokens",
  "get_price",
  "get_quote",
  "build_swap",
  "get_receipt",
  "get_balance",
] as const;

type ToolName = (typeof TOOLS)[number];

type Asset = {
  symbol: string;
  name: string;
  mint: string;
  decimals: number;
  marketCap?: number;
};

type Settings = {
  network: "mainnet" | "devnet";
  slippageBps: number;
  tools: ToolName[];
  confirm: boolean;
};

type Rpc = { jsonrpc?: string; id?: unknown; method?: string; params?: unknown };

const KNOWN: Asset[] = [
  { symbol: SOL.symbol, name: "Solana", mint: SOL.mint, decimals: SOL.decimals },
  { symbol: USDC.symbol, name: "USD Coin", mint: USDC.mint, decimals: USDC.decimals },
];

const PROMPTS = [
  {
    name: "swap",
    description: "Quote a swap, show the route, and build the transaction only after the user agrees.",
    arguments: [
      { name: "amount", description: "Amount to sell, in human units such as 0.1", required: true },
      { name: "from", description: "Token to sell. A symbol or a mint.", required: true },
      { name: "to", description: "Token to buy. A symbol or a mint.", required: true },
      { name: "wallet", description: "Wallet that will sign the transaction.", required: false },
    ],
  },
  {
    name: "price",
    description: "Ask what one amount of a token buys right now, and which venue wins.",
    arguments: [
      { name: "amount", description: "Amount of the token being sold.", required: true },
      { name: "from", description: "Token to price from.", required: true },
      { name: "to", description: "Token to price into.", required: true },
    ],
  },
  {
    name: "receipt",
    description: "Ask whether a coin is still on the bonding curve, plus creator fee, mayhem, and cashback.",
    arguments: [{ name: "token", description: "Coin symbol or mint.", required: true }],
  },
  {
    name: "sell",
    description: "Build a sell into SOL for a wallet the user names.",
    arguments: [
      { name: "amount", description: "Amount of the token to sell.", required: true },
      { name: "token", description: "Token to sell.", required: true },
      { name: "wallet", description: "Wallet that will sign.", required: true },
    ],
  },
] as const;

export function mcpOptions(): NextResponse {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function mcpPost(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return rpcError(null, -32700, "The request body is not JSON.");
  }
  if (Array.isArray(body)) return rpcError(null, -32600, "Send one JSON-RPC message per request.");
  if (!body || typeof body !== "object") return rpcError(null, -32600, "Invalid JSON-RPC request.");
  const message = body as Rpc;
  if (message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    return rpcError(message.id ?? null, -32600, "Invalid JSON-RPC request.");
  }
  if (message.id === undefined) return new NextResponse(null, { status: 202, headers: CORS });

  try {
    const settings = readSettings(request);
    const result = await dispatch(request, settings, message.method, message.params);
    return rpc(message.id, result);
  } catch (caught) {
    const msg = caught instanceof McpError ? caught.message : "The MCP request failed.";
    const code = caught instanceof McpError ? caught.code : -32603;
    return rpcError(message.id, code, msg);
  }
}

class McpError extends Error {
  constructor(
    message: string,
    readonly code = -32602,
  ) {
    super(message);
  }
}

async function dispatch(request: NextRequest, settings: Settings, method: string, params: unknown): Promise<unknown> {
  if (method === "ping") return {};
  if (method === "initialize") return initialize(settings, params);
  if (method === "tools/list") return { tools: toolDefs(settings) };
  if (method === "prompts/list") return { prompts: PROMPTS.map(promptMeta) };
  if (method === "resources/list") return { resources: [skillResource()] };
  if (method === "prompts/get") return promptGet(params);
  if (method === "resources/read") return resourceRead(settings, params);
  if (method === "tools/call") return toolCall(request, settings, params);
  throw new McpError(`Unknown method: ${method}`, -32601);
}

function initialize(settings: Settings, params: unknown) {
  const asked = record(params).protocolVersion;
  const protocolVersion = typeof asked === "string" && PROTOCOL_VERSIONS.includes(asked as (typeof PROTOCOL_VERSIONS)[number])
    ? asked
    : "2025-03-26";
  return {
    protocolVersion,
    capabilities: {
      tools: { listChanged: false },
      prompts: { listChanged: false },
      resources: { listChanged: false },
    },
    serverInfo: { name: "goblock", version: "1.0.0" },
    instructions: instructions(settings),
  };
}

function instructions(settings: Settings): string {
  const confirm = settings.confirm
    ? "Show the venue, the amount received, the minimum, the goblock fee, and the sell-back SOL, then wait for a yes before build_swap."
    : "Confirmation is off for this connection. You may call build_swap after get_quote. Still show the quote before the transaction.";
  const network = settings.network === "devnet"
    ? "This URL asks for devnet, and this server quotes mainnet, so quote and swap tools will refuse until the URL says mainnet."
    : "This server quotes mainnet.";
  return [
    "You are connected to goblock, a Solana swap quoter. You never sign and never send a transaction. The user's wallet does.",
    "Use search_tokens when the user names a coin. Amounts are human units such as 0.1, not lamports.",
    confirm,
    "Pass a mint when a symbol matches more than one token. Do not invent a price, a route, or a mint.",
    "Every tool call needs the x-api-key header.",
    network,
    "Read goblock://skill for the full rules.",
  ].join(" ");
}

function skillResource() {
  return {
    uri: "goblock://skill",
    name: "goblock skill",
    title: "goblock",
    description: "How an agent quotes and builds a goblock swap.",
    mimeType: "text/markdown",
  };
}

function resourceRead(settings: Settings, params: unknown) {
  const uri = record(params).uri;
  if (uri !== "goblock://skill") throw new McpError("Unknown resource.");
  return { contents: [{ uri: "goblock://skill", mimeType: "text/markdown", text: skillText(settings) }] };
}

function skillText(settings: Settings): string {
  return skillMarkdown(settings);
}

function toolDefs(settings: Settings) {
  const defs: Record<ToolName, { description: string; inputSchema: object }> = {
    search_tokens: {
      description: "Find a Solana token by name, symbol, or mint.",
      inputSchema: objectSchema(
        { query: { type: "string", description: "Name, symbol, or mint." }, scope: { type: "string", enum: ["pump", "verified", "equities"] } },
        ["query"],
      ),
    },
    get_price: {
      description: "Price of a token in USD and in SOL.",
      inputSchema: objectSchema({ token: { type: "string", description: "Symbol or mint." } }, ["token"]),
    },
    get_quote: {
      description: "Best swap route for a human amount. Does not build a transaction.",
      inputSchema: objectSchema(
        {
          from: { type: "string", description: "Token to sell. Symbol or mint." },
          to: { type: "string", description: "Token to buy. Symbol or mint." },
          amount: { type: "string", description: "Human amount to sell, such as 0.1." },
          slippageBps: { type: "integer", description: "Slippage in basis points. 100 is 1%." },
        },
        ["from", "to", "amount"],
      ),
    },
    build_swap: {
      description: settings.confirm
        ? "Build an unsigned swap transaction. Call this only after the user agrees to the quote. goblock does not sign or send it."
        : "Build an unsigned swap transaction. goblock does not sign or send it.",
      inputSchema: objectSchema(
        {
          from: { type: "string" },
          to: { type: "string" },
          amount: { type: "string", description: "Human amount to sell." },
          wallet: { type: "string", description: "Wallet that will sign." },
          slippageBps: { type: "integer" },
        },
        ["from", "to", "amount", "wallet"],
      ),
    },
    get_receipt: {
      description: "Coin status from a small SOL quote: graduated or on the bonding curve, creator fee, mayhem, and cashback.",
      inputSchema: objectSchema({ token: { type: "string", description: "Coin symbol or mint." } }, ["token"]),
    },
    get_balance: {
      description: "SOL and token balances for a wallet. Read only.",
      inputSchema: objectSchema(
        {
          wallet: { type: "string" },
          token: { type: "string", description: "Optional symbol or mint. Omit to list the largest balances." },
        },
        ["wallet"],
      ),
    },
  };
  return settings.tools.map((name) => ({ name, ...defs[name] }));
}

async function toolCall(request: NextRequest, settings: Settings, params: unknown) {
  const name = record(params).name;
  const args = record(record(params).arguments);
  if (typeof name !== "string" || !isTool(name)) throw new McpError("Unknown tool.");
  if (!settings.tools.includes(name)) return toolText("This tool is turned off in the MCP URL.", true);
  if (settings.network === "devnet" && name !== "search_tokens") {
    return toolText("This goblock server quotes mainnet. Change the MCP URL network to mainnet.", true);
  }

  const access = await requireKey(request);
  if (access instanceof NextResponse) {
    const body = (await access.json().catch(() => null)) as { msg?: string } | null;
    return toolText(body?.msg ?? "This API needs a key in the x-api-key header.", true);
  }
  const presented = request.headers.get("x-api-key")?.trim() ?? "";
  if (access.rpm !== null && !allowSwap(access.id ?? presented, access.rpm)) {
    return toolText(`This key is limited to ${access.rpm} requests a minute. Wait a moment and try again.`, true);
  }

  try {
    await ensureOperator();
    const text = await runTool(name, args, settings, access.plan);
    if (access.id) recordUse(access.id, 200);
    return toolText(text);
  } catch (caught) {
    const msg = caught instanceof Error ? caught.message : "The tool failed.";
    if (access.id) recordUse(access.id, 400);
    return toolText(msg, true);
  }
}

async function runTool(name: ToolName, args: Record<string, unknown>, settings: Settings, plan: KeyPlan): Promise<string> {
  if (name === "search_tokens") return searchTool(args);
  if (name === "get_price") return priceTool(args);
  if (name === "get_quote") return quoteTool(args, settings, plan, false);
  if (name === "build_swap") return quoteTool(args, settings, plan, true);
  if (name === "get_receipt") return receiptTool(args, settings, plan);
  return balanceTool(args);
}

async function searchTool(args: Record<string, unknown>): Promise<string> {
  const query = text(args.query);
  if (!query) throw new Error("query is required.");
  const scope = args.scope === "verified" || args.scope === "equities" || args.scope === "pump" ? args.scope : undefined;
  const tokens = prefer(query, await collectTokens(query, scope));
  if (tokens.length === 0) throw new Error(`No token matched ${query}.`);
  return jsonLine(
    tokens.length === 1 ? `${tokens[0].symbol} is ${tokens[0].mint}.` : `${tokens.length} tokens matched ${query}.`,
    { tokens: tokens.map(publicAsset) },
  );
}

async function priceTool(args: Record<string, unknown>): Promise<string> {
  const asset = await resolveOne(text(args.token));
  const [usd, solUsd] = await Promise.all([loadUsdPrice(asset.mint), loadUsdPrice(SOL_MINT)]);
  if (usd === null) throw new Error(`No USD price for ${asset.symbol}.`);
  const sol = asset.mint === SOL_MINT ? 1 : solUsd && solUsd > 0 ? usd / solUsd : null;
  const solText = sol === null ? "" : ` (${trimNumber(sol)} SOL)`;
  return jsonLine(`${asset.symbol} is ${trimNumber(usd)} USD${solText}.`, {
    token: publicAsset(asset),
    usd,
    sol,
  });
}

async function quoteTool(args: Record<string, unknown>, settings: Settings, plan: KeyPlan, build: boolean): Promise<string> {
  const from = await resolveOne(text(args.from));
  const to = await resolveOne(text(args.to));
  if (from.mint === to.mint) throw new Error("The two tokens are the same.");
  const atomic = humanToAtomic(amountText(args.amount), from.decimals);
  const slippageBps = slippage(args.slippageBps, settings.slippageBps);
  const wallet = text(args.wallet);
  if (build && !isMint(wallet)) throw new Error("wallet must be the address that will sign.");
  if (wallet && !isMint(wallet)) throw new Error("wallet is not a valid address.");
  const quote = await quoteBest({
    inputMint: from.mint,
    outputMint: to.mint,
    amount: atomic,
    slippageBps,
    ...(build ? { userPublicKey: wallet } : {}),
    fee: plan === "free" ? freeKeyFee(from.mint, to.mint) : undefined,
  });
  return presentQuote(from, to, atomic, slippageBps, quote, build ? wallet : "");
}

async function receiptTool(args: Record<string, unknown>, settings: Settings, plan: KeyPlan): Promise<string> {
  const asset = await resolveOne(text(args.token));
  if (asset.mint === SOL_MINT) throw new Error("A receipt is for the coin, not for SOL.");
  const atomic = humanToAtomic("0.01", SOL.decimals);
  const quote = await quoteBest({
    inputMint: SOL_MINT,
    outputMint: asset.mint,
    amount: atomic,
    slippageBps: settings.slippageBps,
    fee: plan === "free" ? freeKeyFee(SOL_MINT, asset.mint) : undefined,
  });
  return jsonLine(`${asset.symbol} on ${quote.venue}. ${quote.receipt.graduated ? "Graduated" : "Still on the bonding curve"}.`, {
    token: publicAsset(asset),
    probedWith: "0.01 SOL",
    venue: quote.venue,
    receipt: quote.receipt,
  });
}

async function balanceTool(args: Record<string, unknown>): Promise<string> {
  const wallet = text(args.wallet);
  if (!isMint(wallet)) throw new Error("wallet is not a valid address.");
  const owner = new PublicKey(wallet);
  const wanted = text(args.token);
  const filter = wanted ? (await resolveOne(wanted)).mint : null;
  const [lamports, tokenAccounts, token2022] = await Promise.all([
    connection.getBalance(owner),
    connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM }),
    connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_2022 }),
  ]);
  const tokens = [...tokenAccounts.value, ...token2022.value]
    .map(readBalance)
    .filter((row): row is { mint: string; amount: string; decimals: number } => row !== null && row.amount !== "0")
    .filter((row) => (filter ? row.mint === filter : true))
    .sort((a, b) => Number(b.amount) / 10 ** b.decimals - Number(a.amount) / 10 ** a.decimals)
    .slice(0, 15)
    .map((row) => ({ mint: row.mint, amount: formatAtomic(row.amount, row.decimals) }));
  return jsonLine(`${formatAtomic(String(lamports), 9)} SOL in ${wallet}.`, {
    wallet,
    sol: formatAtomic(String(lamports), 9),
    tokens,
  });
}

function presentQuote(from: Asset, to: Asset, atomic: string, slippageBps: number, quote: SwapQuote, wallet: string): string {
  const sent = formatAtomic(atomic, from.decimals);
  const received = formatAtomic(quote.outAmount, to.decimals);
  const minimum = formatAtomic(quote.minOutAmount, to.decimals);
  const sellBack = quote.roundTripOutAmount ? formatAtomic(quote.roundTripOutAmount, 9) : null;
  const line = `${sent} ${from.symbol} → ${received} ${to.symbol} on ${quote.route ?? quote.venue}. Minimum ${minimum} ${to.symbol} at ${slippageBps / 100}% slippage. goblock fee ${quote.feeBps} bps.${sellBack ? ` Selling straight back would return about ${sellBack} SOL.` : ""}`;
  const body: Record<string, unknown> = {
    from: { ...publicAsset(from), amount: sent },
    to: { ...publicAsset(to), amount: received, minimum },
    venue: quote.venue,
    ...(quote.route ? { route: quote.route } : {}),
    side: quote.side,
    slippageBps,
    priceImpact: formatImpact(quote.priceImpactPct),
    feeBps: quote.feeBps,
    feeSol: formatAtomic(quote.feeAmount, 9),
    networkFeeSol: formatAtomic(quote.networkFeeLamports, 9),
    ...(sellBack ? { sellBackSol: sellBack } : {}),
    receipt: quote.receipt,
  };
  if (!wallet) return jsonLine(line, body);
  if (!quote.transaction) throw new Error("The route was quoted, but no transaction was built.");
  return jsonLine(`${line} The transaction is unsigned. Wallet ${wallet} must approve it. goblock does not send it.`, {
    ...body,
    wallet,
    transaction: quote.transaction,
    lastValidBlockHeight: quote.lastValidBlockHeight ?? null,
  });
}

function promptGet(params: unknown) {
  const name = record(params).name;
  const args = record(record(params).arguments);
  const prompt = PROMPTS.find((item) => item.name === name);
  if (!prompt) throw new McpError("Unknown prompt.");
  const text = promptText(prompt.name, args);
  return {
    description: prompt.description,
    messages: [{ role: "user", content: { type: "text", text } }],
  };
}

function promptText(name: (typeof PROMPTS)[number]["name"], args: Record<string, unknown>): string {
  if (name === "swap") {
    const amount = text(args.amount) || "0.1";
    const from = text(args.from) || "SOL";
    const to = text(args.to) || "USDC";
    const wallet = text(args.wallet);
    return `Swap ${amount} ${from} to ${to}${wallet ? ` for wallet ${wallet}` : ""}. Quote it first. Show the venue, the amount out, the minimum, the goblock fee, and the sell-back SOL. Wait for me to agree before you build the transaction.`;
  }
  if (name === "price") {
    const amount = text(args.amount) || "1";
    const from = text(args.from) || "SOL";
    const to = text(args.to) || "BONK";
    return `What does ${amount} ${from} buy of ${to} right now, and which venue wins?`;
  }
  if (name === "receipt") {
    const token = text(args.token) || "the coin I paste next";
    return `Is ${token} still on the bonding curve? Include the creator fee, mayhem, and cashback.`;
  }
  const amount = text(args.amount) || "half of the balance";
  const token = text(args.token) || "USDC";
  const wallet = text(args.wallet);
  if (!wallet) throw new McpError("The sell prompt needs a wallet.");
  return `Build a sell of ${amount} ${token} to SOL for wallet ${wallet}. Quote it first and wait for me to agree.`;
}

function prefer(query: string, assets: Asset[]): Asset[] {
  const exact = assets.filter((token) => token.symbol.toLowerCase() === query.toLowerCase() || token.mint === query);
  return (exact.length > 0 ? exact : assets).slice(0, 8);
}

async function collectTokens(query: string, scope?: "pump" | "verified" | "equities"): Promise<Asset[]> {
  if (scope) return rank(await searchTokens(query, scope));
  const pinned = KNOWN.filter((token) => token.symbol.toLowerCase() === query.toLowerCase());
  if (pinned.length && !isMint(query)) return pinned;
  if (isMint(query)) {
    const known = KNOWN.find((token) => token.mint === query);
    if (known) return [known];
  }
  const [verified, pump] = await Promise.all([
    searchTokens(query, "verified").catch(() => [] as ListedToken[]),
    searchTokens(query, "pump").catch(() => [] as ListedToken[]),
  ]);
  return rank([...verified, ...pump]);
}

async function resolveOne(query: string): Promise<Asset> {
  if (!query) throw new Error("A token symbol or mint is required.");
  const pinned = KNOWN.find((token) => token.symbol.toLowerCase() === query.toLowerCase() || token.mint === query);
  if (pinned) return pinned;
  const found = await collectTokens(query);
  const exact = found.filter((token) => token.symbol.toLowerCase() === query.toLowerCase() || token.mint === query);
  const pick = exact[0] ?? (found.length === 1 ? found[0] : null);
  if (!pick) {
    const sample = found.slice(0, 3).map((token) => `${token.symbol} ${token.mint}`).join(", ");
    throw new Error(sample ? `More than one token matched ${query}: ${sample}.` : `No token matched ${query}.`);
  }
  return pick;
}

function rank(rows: ListedToken[]): Asset[] {
  const seen = new Set<string>();
  const assets: Asset[] = [];
  for (const row of rows) {
    if (!row.mint || seen.has(row.mint)) continue;
    seen.add(row.mint);
    assets.push({
      symbol: row.symbol,
      name: row.name,
      mint: row.mint,
      decimals: row.decimals,
      ...(typeof row.marketCap === "number" ? { marketCap: row.marketCap } : {}),
    });
  }
  return assets.sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0));
}

function publicAsset(asset: Asset) {
  return { symbol: asset.symbol, name: asset.name, mint: asset.mint, decimals: asset.decimals };
}

function humanToAtomic(amount: string, decimals: number): string {
  const atomic = toAtomic(amount, decimals);
  if (!atomic) throw new Error(`Amount ${amount || "(empty)"} does not fit ${decimals} decimals.`);
  return atomic;
}

function amountText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value.toFixed(12).replace(/\.?0+$/, "");
  }
  return "";
}

function slippage(value: unknown, fallback: number): number {
  const picked = typeof value === "number" ? value : fallback;
  if (!Number.isInteger(picked) || picked < 1 || picked > 5000) throw new Error("Slippage must be a whole number of basis points from 1 to 5000.");
  return picked;
}

function readBalance(row: { account: { data: unknown } }): { mint: string; amount: string; decimals: number } | null {
  const data = row.account.data;
  if (!data || typeof data !== "object" || !("parsed" in data)) return null;
  const parsed = data.parsed;
  if (!parsed || typeof parsed !== "object" || !("info" in parsed)) return null;
  const info = parsed.info;
  if (!info || typeof info !== "object") return null;
  const mint = "mint" in info && typeof info.mint === "string" ? info.mint : "";
  const tokenAmount = "tokenAmount" in info && info.tokenAmount && typeof info.tokenAmount === "object" ? info.tokenAmount : null;
  const amount = tokenAmount && "amount" in tokenAmount && typeof tokenAmount.amount === "string" ? tokenAmount.amount : "";
  const decimals = tokenAmount && "decimals" in tokenAmount && typeof tokenAmount.decimals === "number" ? tokenAmount.decimals : 0;
  if (!mint || !amount) return null;
  return { mint, amount, decimals };
}

function readSettings(request: NextRequest): Settings {
  const params = request.nextUrl.searchParams;
  const network = params.get("network") === "devnet" ? "devnet" : "mainnet";
  const slippageRaw = Number(params.get("slippageBps") ?? "100");
  const slippageBps = Number.isInteger(slippageRaw) && slippageRaw >= 1 && slippageRaw <= 5000 ? slippageRaw : 100;
  const asked = params.get("tools");
  const tools = asked
    ? TOOLS.filter((name) => asked.split(",").includes(name))
    : [...TOOLS];
  return { network, slippageBps, tools: tools.length > 0 ? tools : [...TOOLS], confirm: params.get("confirm") !== "off" };
}

function promptMeta(prompt: (typeof PROMPTS)[number]) {
  return { name: prompt.name, description: prompt.description, arguments: prompt.arguments };
}

function objectSchema(properties: Record<string, object>, required: string[]) {
  return { type: "object", properties, required, additionalProperties: false };
}

function isTool(name: string): name is ToolName {
  return (TOOLS as readonly string[]).includes(name);
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function jsonLine(line: string, body: unknown): string {
  return `${line}\n${JSON.stringify(body)}`;
}

function trimNumber(value: number): string {
  if (value >= 1) return value.toFixed(4).replace(/\.?0+$/, "");
  return value.toPrecision(4).replace(/\.?0+$/, "");
}

function toolText(textValue: string, isError = false) {
  return { content: [{ type: "text", text: textValue }], ...(isError ? { isError: true } : {}) };
}

function rpc(id: unknown, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id, result }, { headers: CORS });
}

function rpcError(id: unknown, code: number, message: string) {
  return NextResponse.json({ jsonrpc: "2.0", id, error: { code, message } }, { status: 200, headers: CORS });
}
