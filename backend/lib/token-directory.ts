import { PublicKey } from "@solana/web3.js";
import { SOL_MINT, isMint } from "@/lib/tokens";
import { connection } from "./trade";

export type ListedToken = {
  symbol: string;
  name: string;
  mint: string;
  decimals: number;
  image?: string;
  verified?: boolean;
  marketCap?: number;
  createdAt?: number;
};

type JupiterToken = {
  id: string;
  name: string;
  symbol: string;
  icon?: string;
  decimals?: number;
  mcap?: number;
  tags?: string[];
  createdAt?: string;
  firstPool?: { createdAt?: string };
};

const METADATA_PROGRAM = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
const LIST_URL = "https://lite-api.jup.ag/tokens/v2/tag?query=verified";
const STOCK_URL = "https://lite-api.jup.ag/tokens/v2/search?query=xStock";
const JUP_SEARCH = "https://api.jup.ag/tokens/v2/search?query=";
const LITE_SEARCH = "https://lite-api.jup.ag/tokens/v2/search?query=";
const PUMP_URL = "https://frontend-api-v3.pump.fun/coins";
const PUMP_COIN_URL = "https://frontend-api-v3.pump.fun/coins-v2";
const PUMP_HEADERS = { Accept: "application/json", "User-Agent": "Mozilla/5.0" };

let cache: { at: number; tokens: JupiterToken[] } | null = null;
let stockCache: { at: number; tokens: JupiterToken[] } | null = null;
const pumpCache = new Map<string, { at: number; tokens: ListedToken[] }>();
const searchCache = new Map<string, { at: number; tokens: JupiterToken[] }>();

type PumpCoin = {
  mint?: string;
  name?: string;
  symbol?: string;
  image_uri?: string;
  decimals?: number;
  base_decimals?: number;
  usd_market_cap?: number;
  created_timestamp?: number;
};

function mapToken(token: JupiterToken, verified = true): ListedToken {
  const created = Date.parse(token.createdAt || token.firstPool?.createdAt || "");
  const marketCap = typeof token.mcap === "number" && token.mcap > 0 ? token.mcap : undefined;
  return {
    symbol: token.symbol,
    name: token.name,
    mint: token.id,
    decimals: typeof token.decimals === "number" ? token.decimals : 6,
    image: tokenImage(token.id, token.icon),
    verified,
    ...(marketCap ? { marketCap } : {}),
    ...(Number.isFinite(created) && created > 0 ? { createdAt: created } : {}),
  };
}

function tokenImage(mint: string, icon?: string): string | undefined {
  return normalizeImage(icon) ?? (mint.endsWith("pump") ? `https://images.pump.fun/coin-image/${mint}` : undefined);
}

function normalizeImage(url?: string): string | undefined {
  if (!url) return undefined;
  const fixed = url.trim().replace(/^https?:\/\//i, (scheme) => scheme.toLowerCase());
  const cid = ipfsPath(fixed);
  return cid ? `https://ipfs.filebase.io/ipfs/${cid}` : fixed;
}

function ipfsPath(url: string): string | null {
  const fromScheme = url.match(/^ipfs:\/\/(?:ipfs\/)?([^?#]+)/i);
  if (fromScheme) return fromScheme[1];
  try {
    const parsed = new URL(url);
    const inPath = parsed.pathname.match(/\/ipfs\/([^?#]+)/);
    if (inPath && /ipfs|pinata|nftstorage|dweb|w3s/i.test(parsed.hostname)) return inPath[1];
    const hostCid = parsed.hostname.match(/^((?:Qm[1-9A-HJ-NP-Za-km-z]{44})|(?:ba[a-z2-7]{20,}))\.ipfs\./i);
    if (hostCid) return `${hostCid[1]}${parsed.pathname}`;
  } catch {
    return null;
  }
  return null;
}

let listPauseUntil = 0;
let inflight: Promise<JupiterToken[]> | null = null;

function refreshVerified(): Promise<JupiterToken[]> {
  if (inflight) return inflight;
  inflight = (async () => {
    if (Date.now() < listPauseUntil) {
      if (cache) return cache.tokens;
      throw new Error("The token list asked for a short pause.");
    }
    const response = await fetch(LIST_URL, { cache: "no-store" });
    if (response.status === 429) {
      listPauseUntil = Date.now() + 20_000;
      if (cache) return cache.tokens;
      throw new Error("The token list asked for a short pause.");
    }
    if (!response.ok) throw new Error("The token list is unavailable.");
    const tokens = (await response.json()) as JupiterToken[];
    cache = { at: Date.now(), tokens };
    return tokens;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

async function loadVerified(): Promise<JupiterToken[]> {
  if (cache && Date.now() - cache.at < 5 * 60 * 1000) return cache.tokens;
  if (cache) {
    void refreshVerified().catch(() => undefined);
    return cache.tokens;
  }
  return refreshVerified();
}

async function loadEquities(): Promise<JupiterToken[]> {
  if (stockCache && Date.now() - stockCache.at < 5 * 60 * 1000) return stockCache.tokens;
  const response = await fetch(STOCK_URL, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) {
    if (stockCache) return stockCache.tokens;
    throw new Error("The stock list is unavailable.");
  }
  const body = (await response.json()) as JupiterToken[];
  const tokens = (Array.isArray(body) ? body : [])
    .filter((token) => token.tags?.includes("xstocks"))
    .sort((left, right) => left.symbol.localeCompare(right.symbol));
  stockCache = { at: Date.now(), tokens };
  return tokens;
}

const jupMintCache = new Map<string, { at: number; token: ListedToken | null }>();
let jupPauseUntil = 0;

async function readJupiterMint(mint: string, force = false): Promise<ListedToken | null> {
  const hit = jupMintCache.get(mint);
  const freshFor = hit?.token ? 60_000 : 10_000;
  if (hit && Date.now() - hit.at < freshFor) return hit.token;
  if (!force && Date.now() < jupPauseUntil) return hit?.token ?? null;
  try {
    const response = await fetch(`${JUP_SEARCH}${mint}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (response.status === 429) {
      jupPauseUntil = Date.now() + 12_000;
      return hit?.token ?? null;
    }
    if (!response.ok) return hit?.token ?? null;
    const body = (await response.json()) as JupiterToken[];
    const found = (Array.isArray(body) ? body : []).find((token) => token.id === mint);
    const token = found ? mapToken(found, Boolean(found.tags?.includes("verified"))) : null;
    jupMintCache.set(mint, { at: Date.now(), token });
    return token;
  } catch {
    return hit?.token ?? null;
  }
}

async function withJupiterMeta(coins: ListedToken[]): Promise<ListedToken[]> {
  const rows: ListedToken[] = [];
  for (let index = 0; index < coins.length; index += 4) {
    const chunk = coins.slice(index, index + 4);
    const metas = await Promise.all(chunk.map((coin) => readJupiterMint(coin.mint)));
    chunk.forEach((coin, offset) => {
      const meta = metas[offset];
      rows.push(
        meta
          ? { ...coin, ...meta, image: meta.image || coin.image, verified: meta.verified || coin.verified }
          : coin,
      );
    });
    if (Date.now() < jupPauseUntil) {
      rows.push(...coins.slice(index + chunk.length));
      break;
    }
  }
  return rows;
}

function createdMs(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return undefined;
  return value < 1e12 ? value * 1000 : value;
}

function mapPump(coin: PumpCoin, verified = false): ListedToken | null {
  if (!coin.mint || !isMint(coin.mint)) return null;
  const marketCap = typeof coin.usd_market_cap === "number" && coin.usd_market_cap > 0 ? coin.usd_market_cap : undefined;
  return {
    symbol: coin.symbol?.trim() || "TOKEN",
    name: coin.name?.trim() || "Token",
    mint: coin.mint,
    decimals: typeof coin.decimals === "number" ? coin.decimals : coin.base_decimals ?? 6,
    image: tokenImage(coin.mint, coin.image_uri),
    verified,
    ...(marketCap ? { marketCap } : {}),
    ...(createdMs(coin.created_timestamp) ? { createdAt: createdMs(coin.created_timestamp) } : {}),
  };
}

async function searchJupiter(query: string): Promise<JupiterToken[]> {
  const key = query.trim().toLowerCase();
  const hit = searchCache.get(key);
  if (hit && Date.now() - hit.at < 30_000) return hit.tokens;
  try {
    const response = await fetch(`${LITE_SEARCH}${encodeURIComponent(query.trim())}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return hit?.tokens ?? [];
    const body = (await response.json()) as JupiterToken[];
    const tokens = Array.isArray(body) ? body : [];
    searchCache.set(key, { at: Date.now(), tokens });
    return tokens;
  } catch {
    return hit?.tokens ?? [];
  }
}

function matchesQuery(token: { symbol?: string; name?: string; id?: string }, lowered: string) {
  return (
    token.symbol?.toLowerCase().includes(lowered) ||
    token.name?.toLowerCase().includes(lowered) ||
    token.id?.toLowerCase().startsWith(lowered)
  );
}

async function loadFreshPump(query: string): Promise<ListedToken[]> {
  const key = query.trim().toLowerCase();
  const hit = pumpCache.get(key);
  if (hit && Date.now() - hit.at < 15_000) return hit.tokens;
  const params = new URLSearchParams({
    offset: "0",
    limit: "40",
    sort: "created_timestamp",
    order: "DESC",
    includeNsfw: "false",
  });
  if (key) params.set("searchTerm", query.trim());
  try {
    const response = await fetch(`${PUMP_URL}?${params}`, { headers: PUMP_HEADERS, cache: "no-store" });
    if (!response.ok) return hit?.tokens ?? [];
    const body = (await response.json()) as PumpCoin[];
    const tokens = (Array.isArray(body) ? body : []).map((coin) => mapPump(coin)).filter((token): token is ListedToken => Boolean(token));
    pumpCache.set(key, { at: Date.now(), tokens });
    return tokens;
  } catch {
    return hit?.tokens ?? [];
  }
}

async function readPumpCoin(mint: string): Promise<ListedToken | null> {
  try {
    const response = await fetch(`${PUMP_COIN_URL}/${mint}`, { headers: PUMP_HEADERS, cache: "no-store", signal: AbortSignal.timeout(4000) });
    if (!response.ok) return null;
    const body = (await response.json()) as PumpCoin;
    return mapPump(body);
  } catch {
    return null;
  }
}

void refreshVerified().catch(() => undefined);

function readBorshString(data: Uint8Array, offset: number): [string, number] {
  if (offset + 4 > data.length) return ["", offset];
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const length = view.getUint32(offset, true);
  const start = offset + 4;
  if (length > 200 || start + length > data.length) return ["", start];
  const text = new TextDecoder().decode(data.subarray(start, start + length)).replace(/\0/g, "").trim();
  return [text, start + length];
}

function imageUrl(uri: string): string {
  if (uri.startsWith("ipfs://")) return `https://ipfs.io/ipfs/${uri.slice("ipfs://".length)}`;
  return uri;
}

async function imageFromUri(uri: string): Promise<string | undefined> {
  if (!uri.startsWith("http") && !uri.startsWith("ipfs://")) return undefined;
  try {
    const response = await fetch(imageUrl(uri), { signal: AbortSignal.timeout(4000) });
    if (!response.ok) return undefined;
    const body = (await response.json()) as { image?: string };
    return body.image ? normalizeImage(imageUrl(body.image)) : undefined;
  } catch {
    return undefined;
  }
}

const TOKEN_METADATA = 19;
const MINT_HEADER = 165;

async function readEmbeddedMint(mint: string, data: Uint8Array): Promise<ListedToken | null> {
  const fields = readToken2022Metadata(data);
  if (!fields) return null;
  return {
    symbol: fields.symbol || "TOKEN",
    name: fields.name || "Token",
    mint,
    decimals: data[44] ?? 6,
    image: (await imageFromUri(fields.uri)) ?? (mint.endsWith("pump") ? `https://images.pump.fun/coin-image/${mint}` : undefined),
    verified: false,
  };
}

function readToken2022Metadata(data: Uint8Array): { name: string; symbol: string; uri: string } | null {
  if (data.length <= MINT_HEADER + 1 || data[MINT_HEADER] !== 1) return null;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = MINT_HEADER + 1;
  while (offset + 4 <= data.length) {
    const type = view.getUint16(offset, true);
    const length = view.getUint16(offset + 2, true);
    const start = offset + 4;
    if (length > data.length || start + length > data.length) return null;
    if (type === TOKEN_METADATA) {
      let cursor = start + 64;
      const [name, afterName] = readBorshString(data, cursor);
      const [symbol, afterSymbol] = readBorshString(data, afterName);
      const [uri] = readBorshString(data, afterSymbol);
      if (!name && !symbol) return null;
      return { name, symbol, uri };
    }
    offset = start + length;
  }
  return null;
}

export async function readMint(mint: string): Promise<ListedToken | null> {
  try {
    const mintKey = new PublicKey(mint);
    const [metadata] = PublicKey.findProgramAddressSync(
      [Buffer.from("metadata"), METADATA_PROGRAM.toBuffer(), mintKey.toBuffer()],
      METADATA_PROGRAM,
    );
    const [meta, account] = await Promise.all([
      connection.getAccountInfo(metadata),
      connection.getAccountInfo(mintKey),
    ]);
    if (!meta?.data) return account?.data ? readEmbeddedMint(mint, account.data) : null;
    let offset = 1 + 32 + 32;
    const [name, afterName] = readBorshString(meta.data, offset);
    const [symbol, afterSymbol] = readBorshString(meta.data, afterName);
    const [uri] = readBorshString(meta.data, afterSymbol);
    const decimals = account?.data?.[44] ?? 6;
    return {
      symbol: symbol || "TOKEN",
      name: name || "Token",
      mint,
      decimals,
      image: await imageFromUri(uri),
      verified: false,
    };
  } catch {
    return null;
  }
}

const described = new Map<string, { at: number; token: ListedToken | null }>();

function namedToken(token: ListedToken | null): token is ListedToken {
  return Boolean(token && (token.symbol !== "TOKEN" || token.name !== "Token"));
}

async function describeMint(mint: string): Promise<ListedToken | null> {
  const hit = described.get(mint);
  if (hit && Date.now() - hit.at < (hit.token ? 10 * 60_000 : 20_000)) return hit.token;
  const launched = await readPumpCoin(mint);
  const onChain = namedToken(launched) ? null : await readMint(mint);
  const token = namedToken(onChain) ? onChain : launched ?? onChain;
  described.set(mint, { at: Date.now(), token });
  return token;
}

export async function describeMints(mints: string[]): Promise<ListedToken[]> {
  const unique = [...new Set(mints.map((mint) => mint.trim()).filter((mint) => isMint(mint)))].slice(0, 24);
  const tokens: ListedToken[] = [];
  for (let index = 0; index < unique.length; index += 6) {
    const chunk = await Promise.all(unique.slice(index, index + 6).map(describeMint));
    for (const token of chunk) if (token) tokens.push(token);
  }
  return tokens;
}

async function resolveMint(mint: string, scope: "pump" | "verified" | "equities"): Promise<ListedToken | null> {
  const fromJupiter = await readJupiterMint(mint, true);
  if (fromJupiter) return fromJupiter;
  if (scope === "pump") {
    const launched = await readPumpCoin(mint);
    if (launched) return launched;
  }
  return readMint(mint);
}

export async function searchTokens(query: string, scope: "pump" | "verified" | "equities" = "pump"): Promise<ListedToken[]> {
  const needle = query.trim();
  const lowered = needle.toLowerCase();
  if (isMint(needle)) {
    const token = await resolveMint(needle, scope);
    return token ? [token] : [];
  }
  if (scope === "equities") {
    let stocks: JupiterToken[] = [];
    try {
      stocks = await loadEquities();
    } catch {
      stocks = [];
    }
    const matches = lowered
      ? stocks.filter(
          (token) =>
            token.symbol.toLowerCase().includes(lowered) ||
            token.name.toLowerCase().includes(lowered) ||
            token.id.toLowerCase().startsWith(lowered),
        )
      : stocks;
    const rows = matches.slice(0, 40).map((token) => mapToken(token));
    if (isMint(needle) && !rows.some((token) => token.mint === needle)) {
      const fromJupiter = await readJupiterMint(needle);
      const onChain = fromJupiter ?? (await readMint(needle));
      if (onChain) rows.unshift(onChain);
    }
    return rows;
  }

  let verified: JupiterToken[] = [];
  let searched: JupiterToken[] = [];
  try {
    [verified, searched] = await Promise.all([
      loadVerified().catch(() => [] as JupiterToken[]),
      lowered ? searchJupiter(needle) : Promise.resolve([] as JupiterToken[]),
    ]);
  } catch {
    verified = [];
    searched = [];
  }

  const pool =
    scope === "verified"
      ? verified.filter((token) => token.id !== SOL_MINT)
      : verified.filter((token) => token.id.endsWith("pump") && token.id !== SOL_MINT);
  const ranked = [...pool].sort((a, b) => (b.mcap ?? 0) - (a.mcap ?? 0));
  const matches = lowered
    ? pool.filter(
        (token) =>
          token.symbol.toLowerCase().includes(lowered) ||
          token.name.toLowerCase().includes(lowered) ||
          token.id.toLowerCase().startsWith(lowered),
      )
    : ranked;
  const known = new Set(pool.map((token) => token.id));
  let fresh: ListedToken[] = [];
  if (scope === "pump" && !isMint(needle)) {
    try {
      const launched = await loadFreshPump(needle);
      fresh = launched
        .filter(
          (token) =>
            !lowered ||
            token.symbol.toLowerCase().includes(lowered) ||
            token.name.toLowerCase().includes(lowered) ||
            token.mint.toLowerCase().startsWith(lowered),
        )
        .map((token) => ({ ...token, verified: token.verified || known.has(token.mint) }));
    } catch {
      fresh = [];
    }
  }
  const seen = new Set<string>();
  const found: ListedToken[] = [];
  if (lowered) {
    for (const token of searched) {
      if (!token.id || seen.has(token.id) || !matchesQuery(token, lowered)) continue;
      if (scope === "verified" && !token.tags?.includes("verified")) continue;
      seen.add(token.id);
      found.push(mapToken(token, Boolean(token.tags?.includes("verified"))));
      if (found.length >= 40) return found;
    }
  }
  const picked: ListedToken[] = [];
  for (const token of fresh) {
    if (seen.has(token.mint)) continue;
    seen.add(token.mint);
    picked.push(token);
    if (picked.length >= (lowered ? 16 : 12)) break;
  }
  const rows: ListedToken[] = [...found, ...(await withJupiterMeta(picked))];
  for (const token of matches.map((token) => mapToken(token))) {
    if (seen.has(token.mint)) continue;
    seen.add(token.mint);
    rows.push(token);
    if (rows.length >= 40) break;
  }

  if (isMint(needle) && !rows.some((token) => token.mint === needle)) {
    const fromJupiter = await readJupiterMint(needle);
    const launched = fromJupiter ? null : scope === "pump" ? await readPumpCoin(needle) : null;
    const onChain = fromJupiter ?? launched ?? (await readMint(needle));
    if (onChain) rows.unshift(onChain);
  }

  return rows.slice(0, 40);
}
