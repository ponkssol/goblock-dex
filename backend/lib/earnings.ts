import { PublicKey } from "@solana/web3.js";
import { connection, pacedFetch } from "./rpc";
import { GOBLOCK_PROGRAM_ID } from "./route";

const SCAN = 50;
const CACHE_MS = 60_000;
const PROGRAM = GOBLOCK_PROGRAM_ID.toBase58();
const cache = new Map<string, { at: number; value: WalletEarnings }>();

export type WalletEarnings = {
  wallet: string;
  lamports: number;
  swaps: number;
  lastAt: number | null;
  scanned: number;
};

type ParsedTx = {
  blockTime: number | null;
  meta: { err: unknown; preBalances: number[]; postBalances: number[] } | null;
  transaction: {
    message: {
      accountKeys: { pubkey: string; signer: boolean }[];
      instructions: { programId: string }[];
    };
  };
};

/** Raw JSON-RPC, because web3.js 1.x cannot decode version 1 transactions. */
async function parsedTransactions(signatures: string[]): Promise<(ParsedTx | null)[]> {
  if (signatures.length === 0) return [];
  const response = await pacedFetch(connection.rpcEndpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(
      signatures.map((signature, id) => ({
        jsonrpc: "2.0",
        id,
        method: "getTransaction",
        params: [signature, { encoding: "jsonParsed", commitment: "confirmed", maxSupportedTransactionVersion: 1 }],
      })),
    ),
  });
  if (!response.ok) throw new Error(`RPC answered ${response.status}.`);
  const replies = (await response.json()) as { id: number; result?: ParsedTx | null; error?: { message: string } }[];
  const failed = replies.find((reply) => reply.error);
  if (failed?.error) throw new Error(failed.error.message);
  const byId = new Map(replies.map((reply) => [reply.id, reply.result ?? null]));
  return signatures.map((_, id) => byId.get(id) ?? null);
}

function received(tx: ParsedTx, wallet: string): number {
  const { meta, transaction } = tx;
  if (!meta || meta.err) return 0;
  if (!transaction.message.instructions.some((instruction) => instruction.programId === PROGRAM)) return 0;
  const index = transaction.message.accountKeys.findIndex((key) => key.pubkey === wallet);
  if (index < 0 || transaction.message.accountKeys[index].signer) return 0;
  return Math.max(0, meta.postBalances[index] - meta.preBalances[index]);
}

async function scan(wallet: string): Promise<WalletEarnings> {
  const signatures = await connection.getSignaturesForAddress(new PublicKey(wallet), { limit: SCAN });
  const txs = await parsedTransactions(signatures.filter((entry) => !entry.err).map((entry) => entry.signature));
  const result: WalletEarnings = { wallet, lamports: 0, swaps: 0, lastAt: null, scanned: signatures.length };
  for (const tx of txs) {
    const lamports = tx ? received(tx, wallet) : 0;
    if (!tx || lamports === 0) continue;
    result.lamports += lamports;
    result.swaps += 1;
    if (tx.blockTime) result.lastAt = Math.max(result.lastAt ?? 0, tx.blockTime * 1000);
  }
  return result;
}

/** SOL each fee wallet received from goblock swaps among its latest transactions. */
export async function earnings(wallets: string[]): Promise<WalletEarnings[]> {
  return Promise.all(
    wallets.map(async (wallet) => {
      const hit = cache.get(wallet);
      if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
      const value = await scan(wallet);
      cache.set(wallet, { at: Date.now(), value });
      return value;
    }),
  );
}
