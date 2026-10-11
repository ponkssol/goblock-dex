import { AsyncLocalStorage } from "node:async_hooks";
import { getAssociatedTokenAddressSync, NATIVE_MINT, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  AddressLookupTableAccount,
  ComputeBudgetProgram,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import BN from "bn.js";
import { brandFee, feeShares } from "./fees";
import { connection } from "./rpc";
import { routeInstruction } from "./route";
import { SOL_MINT } from "./tokens";
import type { SwapQuote, SwapReceipt, SwapVenue } from "./quote";

export { connection };

export const CU_LIMIT = 600_000;
const PRIORITY_FEE_CAP_LAMPORTS = 100_000;
const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

const decimalsCache = new Map<string, number>();
let priorityCache: { at: number; microLamports: number } | null = null;

type PriorityChoice = { mode: "max" | "exact"; lamports: number };
const priorityChoice = new AsyncLocalStorage<PriorityChoice>();

export function withPriorityChoice<T>(choice: PriorityChoice | null, run: () => Promise<T>): Promise<T> {
  if (!choice) return run();
  return priorityChoice.run(choice, run);
}

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

let priorityInflight: Promise<number> | null = null;

export function priorityFeeMicroLamports(): Promise<number> {
  return observedMicroLamports().then((observed) => clampPriority(observed));
}

function clampPriority(observed: number): number {
  const choice = priorityChoice.getStore();
  if (choice?.mode === "exact") return Math.floor((choice.lamports * 1_000_000) / CU_LIMIT);
  const capLamports = choice?.lamports ?? PRIORITY_FEE_CAP_LAMPORTS;
  const cap = Math.floor((capLamports * 1_000_000) / CU_LIMIT);
  return Math.min(Math.max(observed, 1_000), cap);
}

function observedMicroLamports(): Promise<number> {
  if (priorityCache && Date.now() - priorityCache.at < 60_000) return Promise.resolve(priorityCache.microLamports);
  if (!priorityInflight) {
    priorityInflight = readPriorityFee().finally(() => {
      priorityInflight = null;
    });
  }
  return priorityInflight;
}

async function readPriorityFee(): Promise<number> {
  try {
    const recent = await connection.getRecentPrioritizationFees();
    const samples = recent
      .map((fee) => fee.prioritizationFee)
      .filter((fee) => fee > 0)
      .sort((left, right) => left - right);
    const observed = samples.length > 0 ? samples[Math.floor(samples.length * 0.6)] : 1_000;
    priorityCache = { at: Date.now(), microLamports: observed };
    return observed;
  } catch {
    const observed = priorityCache?.microLamports ?? 1_000;
    priorityCache = { at: Date.now(), microLamports: observed };
    return observed;
  }
}

export async function bestQuote(miss: string, attempts: Promise<SwapQuote>[]): Promise<SwapQuote> {
  const settled = await Promise.allSettled(attempts.map((attempt) => limitQuote(attempt)));
  const quotes = settled.flatMap((item) => (item.status === "fulfilled" ? [item.value] : []));
  if (quotes.length > 0) {
    return quotes.reduce((best, quote) => (new BN(quote.outAmount).gt(new BN(best.outAmount)) ? quote : best));
  }
  const migrating = settled.some(
    (item) => item.status === "rejected" && item.reason instanceof Error && item.reason.message.includes("migrating"),
  );
  throw new Error(migrating ? "This token is migrating. Try again in a moment." : miss);
}

function limitQuote<T>(promise: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("The venue quote timed out.")), 3_500);
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

export async function networkFeeLamports(): Promise<string> {
  const microLamports = await priorityFeeMicroLamports();
  return String(5_000 + Math.floor((microLamports * CU_LIMIT) / 1_000_000));
}

export async function receivingAccount(owner: PublicKey, mint: string): Promise<PublicKey> {
  const mintKey = mint === SOL_MINT ? NATIVE_MINT : new PublicKey(mint);
  let program = TOKEN_PROGRAM_ID;
  if (mint !== SOL_MINT) {
    const info = await connection.getAccountInfo(mintKey);
    if (!info) throw new Error("Could not read the output mint.");
    program = info.owner;
  }
  return getAssociatedTokenAddressSync(mintKey, owner, false, program);
}

export async function buildSwapTransaction(args: {
  user: PublicKey;
  instructions: TransactionInstruction[];
  lookupTables?: AddressLookupTableAccount[];
  brand?: string;
  brandWallet?: string;
  fee: BN;
  outputMint: string;
  minOut: BN;
}): Promise<{ transaction: string; lastValidBlockHeight: number }> {
  const microLamports = await priorityFeeMicroLamports();
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const forwarded = args.instructions.filter(
    (instruction) => !instruction.programId.equals(ComputeBudgetProgram.programId),
  );
  const output = await receivingAccount(args.user, args.outputMint);
  const mint = new PublicKey(args.outputMint === SOL_MINT ? NATIVE_MINT : args.outputMint);
  const feeOnMinimum = args.outputMint === SOL_MINT && args.fee.gtn(0) ? brandFee(args.minOut, true) : new BN(0);
  const brandWallet = args.brandWallet ? new PublicKey(args.brandWallet) : null;
  const shares = brandWallet && args.fee.gtn(0) ? feeShares(brandWallet, args.fee) : null;
  const route = routeInstruction(
    args.user,
    forwarded,
    {
      account: output,
      mint,
      amount: args.minOut.add(feeOnMinimum),
      after: args.brand ? [brandMemo(args.brand, args.user)] : [],
    },
    brandWallet && shares
      ? {
          lamports: args.fee,
          brand: brandWallet,
          treasury: shares.treasury,
          treasuryLamports: shares.treasuryLamports,
        }
      : undefined,
  );
  const limit = ComputeBudgetProgram.setComputeUnitLimit({ units: CU_LIMIT });
  const price = ComputeBudgetProgram.setComputeUnitPrice({ microLamports });
  const compile = (includePrice: boolean) =>
    new TransactionMessage({
      payerKey: args.user,
      recentBlockhash: blockhash,
      instructions: includePrice ? [limit, price, route] : [limit, route],
    }).compileToV0Message(args.lookupTables ?? []);
  let message = compile(true);
  if (new VersionedTransaction(message).serialize().length > 1232) message = compile(false);
  if (message.header.numRequiredSignatures !== 1) {
    throw new Error("This route needs another signature.");
  }
  const serialized = new VersionedTransaction(message).serialize();
  if (serialized.length > 1232) throw new Error("This pair does not fit in one transaction.");
  return {
    transaction: Buffer.from(serialized).toString("base64"),
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
