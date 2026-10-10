import { Connection, PublicKey } from "@solana/web3.js";
import { SOL_MINT, isMint } from "@/lib/tokens";

export type ListedToken = {
  symbol: string;
  name: string;
  mint: string;
  decimals: number;
  image?: string;
  verified?: boolean;
};

type JupiterToken = {
  id: string;
  name: string;
  symbol: string;
  icon?: string;
  decimals: number;
  mcap?: number;
};

const METADATA_PROGRAM = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
const LIST_URL = "https://lite-api.jup.ag/tokens/v2/tag?query=verified";
const RPC = process.env.SOLANA_RPC_URL ?? process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://solana-rpc.publicnode.com";

let cache: { at: number; tokens: JupiterToken[] } | null = null;

function mapToken(token: JupiterToken, verified = true): ListedToken {
  return {
    symbol: token.symbol,
    name: token.name,
    mint: token.id,
    decimals: token.decimals,
    image: tokenImage(token.id, token.icon),
    verified,
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

async function loadVerified(): Promise<JupiterToken[]> {
  if (cache && Date.now() - cache.at < 5 * 60 * 1000) return cache.tokens;
  const response = await fetch(LIST_URL, { cache: "no-store" });
  if (!response.ok) throw new Error("The token list is unavailable.");
  const tokens = (await response.json()) as JupiterToken[];
  cache = { at: Date.now(), tokens };
  return tokens;
}

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

export async function readMint(mint: string): Promise<ListedToken | null> {
  try {
    const connection = new Connection(RPC, "confirmed");
    const mintKey = new PublicKey(mint);
    const [metadata] = PublicKey.findProgramAddressSync(
      [Buffer.from("metadata"), METADATA_PROGRAM.toBuffer(), mintKey.toBuffer()],
      METADATA_PROGRAM,
    );
    const [meta, account] = await Promise.all([
      connection.getAccountInfo(metadata),
      connection.getAccountInfo(mintKey),
    ]);
    if (!meta?.data) return null;
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

export async function searchTokens(query: string, scope: "pump" | "verified" = "pump"): Promise<ListedToken[]> {
  const needle = query.trim();
  const lowered = needle.toLowerCase();
  let verified: JupiterToken[] = [];
  try {
    verified = await loadVerified();
  } catch {
    verified = [];
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
  const rows = matches.slice(0, 40).map((token) => mapToken(token));

  if (isMint(needle) && !rows.some((token) => token.mint === needle)) {
    const onChain = await readMint(needle);
    if (onChain) rows.unshift(onChain);
  }

  return rows;
}
