import {
  AddressLookupTableAccount,
  ComputeBudgetProgram,
  Connection,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import BN from "bn.js";
import { brandFee, feeTransfers } from "./fees";
import { SOL_MINT } from "./tokens";
import type { SwapReceipt, SwapVenue } from "./quote";

export const CU_LIMIT = 600_000;
const PRIORITY_FEE_CAP_LAMPORTS = 100_000;
const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

export const connection = new Connection(
  process.env.SOLANA_RPC_URL ?? "https://solana-rpc.publicnode.com",
  "confirmed",
);

const readAccounts = connection.getMultipleAccountsInfo.bind(connection);
connection.getMultipleAccountsInfo = async (keys, commitment) => {
  const accounts = [];
  for (let index = 0; index < keys.length; index += 5) {
    accounts.push(...(await readAccounts(keys.slice(index, index + 5), commitment)));
  }
  return accounts;
};

const decimalsCache = new Map<string, number>();
let priorityCache: { at: number; microLamports: number } | null = null;

export function venueReceipt(venue: SwapVenue): SwapReceipt {
  return {
    venue,
    graduated: false,
    mayhem: false,
    cashback: false,
    creatorFeeBps: 0,
    creator: "",
  };
}

export function solFees(inputMint: string, outputMint: string, amountIn: BN, enabled: boolean): {
  inputFee: BN;
  swapIn: BN;
  outputIsSol: boolean;
} {
  const inputFee = inputMint === SOL_MINT ? brandFee(amountIn, enabled) : new BN(0);
  if (inputFee.gtn(0) && inputFee.gte(amountIn)) throw new Error("Amount is too small for the brand fee.");
  return {
    inputFee,
    swapIn: amountIn.sub(inputFee),
    outputIsSol: outputMint === SOL_MINT && inputMint !== SOL_MINT,
  };
}

export function outputAfterFee(grossOut: BN, outputIsSol: boolean, enabled: boolean): { outAmount: BN; outputFee: BN } {
  const outputFee = outputIsSol ? brandFee(grossOut, enabled) : new BN(0);
  if (outputFee.gtn(0) && outputFee.gte(grossOut)) throw new Error("Amount is too small for the brand fee.");
  return { outAmount: grossOut.sub(outputFee), outputFee };
}

export function impactFraction(midOut: BN, actualOut: BN): string {
  if (midOut.lten(0) || actualOut.gte(midOut)) return "0";
  const scale = new BN(1_000_000_000);
  const scaled = midOut.sub(actualOut).mul(scale).div(midOut);
  const whole = scaled.div(scale).toString();
  const fraction = scaled.mod(scale).toString().padStart(9, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}

export async function mintDecimals(mint: string): Promise<number> {
  if (mint === SOL_MINT) return 9;
  const cached = decimalsCache.get(mint);
  if (cached !== undefined) return cached;
  const info = await connection.getAccountInfo(new PublicKey(mint));
  const decimals = info?.data[44];
  if (decimals === undefined) throw new Error("Could not read token decimals.");
  decimalsCache.set(mint, decimals);
  return decimals;
}

export async function priorityFeeMicroLamports(): Promise<number> {
  if (priorityCache && Date.now() - priorityCache.at < 20_000) return priorityCache.microLamports;
  const cap = Math.floor((PRIORITY_FEE_CAP_LAMPORTS * 1_000_000) / CU_LIMIT);
  try {
    const recent = await connection.getRecentPrioritizationFees();
    const samples = recent
      .map((fee) => fee.prioritizationFee)
      .filter((fee) => fee > 0)
      .sort((left, right) => left - right);
    const observed = samples.length > 0 ? samples[Math.floor(samples.length * 0.6)] : 1_000;
    const microLamports = Math.min(Math.max(observed, 1_000), cap);
    priorityCache = { at: Date.now(), microLamports };
    return microLamports;
  } catch {
    const microLamports = Math.min(1_000, cap);
    priorityCache = { at: Date.now(), microLamports };
    return microLamports;
  }
}

export async function networkFeeLamports(): Promise<string> {
  const microLamports = await priorityFeeMicroLamports();
  return String(5_000 + Math.floor((microLamports * CU_LIMIT) / 1_000_000));
}

export async function buildSwapTransaction(args: {
  user: PublicKey;
  instructions: TransactionInstruction[];
  lookupTables?: AddressLookupTableAccount[];
  brand?: string;
  brandWallet?: string;
  fee: BN;
}): Promise<{ transaction: string; lastValidBlockHeight: number }> {
  const microLamports = await priorityFeeMicroLamports();
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const message = new TransactionMessage({
    payerKey: args.user,
    recentBlockhash: blockhash,
    instructions: [
      ComputeBudgetProgram.setComputeUnitLimit({ units: CU_LIMIT }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports }),
      ...args.instructions.filter((instruction) => !instruction.programId.equals(ComputeBudgetProgram.programId)),
      ...(args.brandWallet ? feeTransfers(args.user, new PublicKey(args.brandWallet), args.fee) : []),
      ...(args.brand ? [brandMemo(args.brand, args.user)] : []),
    ],
  }).compileToV0Message(args.lookupTables ?? []);
  return {
    transaction: Buffer.from(new VersionedTransaction(message).serialize()).toString("base64"),
    lastValidBlockHeight,
  };
}

export async function instructionsFromVersioned(
  transaction: VersionedTransaction,
): Promise<{ instructions: TransactionInstruction[]; lookupTables: AddressLookupTableAccount[] }> {
  const lookups = transaction.message.addressTableLookups;
  const lookupTables: AddressLookupTableAccount[] = [];
  for (const lookup of lookups) {
    const table = await connection.getAddressLookupTable(lookup.accountKey);
    if (!table.value) throw new Error("A lookup table for this swap is missing.");
    lookupTables.push(table.value);
  }
  const message = TransactionMessage.decompile(transaction.message, { addressLookupTableAccounts: lookupTables });
  return { instructions: message.instructions, lookupTables };
}

function brandMemo(brand: string, signer: PublicKey): TransactionInstruction {
  return new TransactionInstruction({
    programId: MEMO_PROGRAM_ID,
    keys: [{ pubkey: signer, isSigner: true, isWritable: false }],
    data: Buffer.from(brand, "utf8"),
  });
}
