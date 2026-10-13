import { PublicKey, Transaction } from "@solana/web3.js";
import BN from "bn.js";
import { chargeFor } from "./fees";
import type { SwapOrderInput, SwapQuote } from "./quote";
import { SOL_MINT } from "./tokens";
import {
  bestQuote,
  buildSwapTransaction,
  connection,
  mintDecimals,
  networkFeeLamports,
  outputAfterFee,
  solFees,
  venueReceipt,
} from "./trade";

const METEORA_PROGRAM_ID = "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo";
const poolCache = new Map<string, { at: number; address: string }>();

type MeteoraPool = {
  pubkey: PublicKey;
  tokenX: { publicKey: PublicKey };
  tokenY: { publicKey: PublicKey };
  getBinArrayForSwap: (swapForY: boolean) => Promise<unknown>;
  swapQuote: (
    inAmount: BN,
    swapForY: boolean,
    slippage: BN,
    binArrays: unknown,
    partial?: boolean,
  ) => {
    outAmount: BN;
    minOutAmount: BN;
    consumedInAmount: BN;
    binArraysPubkey: PublicKey[];
    priceImpact: { toString: () => string };
  };
  swap: (params: {
    inToken: PublicKey;
    outToken: PublicKey;
    inAmount: BN;
    minOutAmount: BN;
    lbPair: PublicKey;
    user: PublicKey;
    binArraysPubkey: PublicKey[];
  }) => Promise<Transaction>;
};

function loadPool(address: PublicKey): Promise<MeteoraPool> {
  const nodeRequire = eval("require") as (id: string) => {
    default?: { create: (connection: typeof import("./trade").connection, pool: PublicKey) => Promise<MeteoraPool> };
    create?: (connection: typeof import("./trade").connection, pool: PublicKey) => Promise<MeteoraPool>;
  };
  const loaded = nodeRequire("@meteora-ag/dlmm");
  const factory = loaded.default ?? loaded;
  if (!factory.create) throw new Error("Meteora SDK did not load.");
  return factory.create(connection, address);
}

export async function quoteMeteora(input: SwapOrderInput): Promise<SwapQuote> {
  const [{ quoteDbc }, { quoteDammV1, quoteDammV2 }] = await Promise.all([import("./dbc"), import("./damm")]);
  try {
    return await bestQuote("No Meteora pool was found for this pair.", [
      quoteDlmm(input),
      quoteDammV2(input),
      quoteDbc(input),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("migrating")) throw error;
    return quoteDammV1(input);
  }
}

async function quoteDlmm(input: SwapOrderInput): Promise<SwapQuote> {
  const amount = new BN(input.amount);
  const charge = chargeFor(input);
  const legs = solFees(input.inputMint, input.outputMint, amount, charge.bps);
  const address = await findPool(input.inputMint, input.outputMint);
  const pool = await loadPool(new PublicKey(address));
  const quoted = await swapQuote(pool, input.inputMint, legs.swapIn, input.slippageBps);
  const { outAmount, outputFee } = outputAfterFee(quoted.grossOut, legs.outputIsSol, charge.bps);
  const minOutAmount = outputAfterFee(quoted.minOut, legs.outputIsSol, charge.bps).outAmount;
  const fee = legs.inputFee.add(outputFee);
  const [inputMintDecimals, outputMintDecimals, feeText] = await Promise.all([
    mintDecimals(input.inputMint),
    mintDecimals(input.outputMint),
    networkFeeLamports(),
  ]);

  const quote: SwapQuote = {
    side: input.inputMint === SOL_MINT ? "buy" : "sell",
    inAmount: amount.toString(),
    outAmount: outAmount.toString(),
    minOutAmount: minOutAmount.toString(),
    maxInAmount: amount.toString(),
    priceImpactPct: decimalFraction(quoted.impact),
    pool: address,
    programId: METEORA_PROGRAM_ID,
    venue: "Meteora",
    receipt: venueReceipt("Meteora"),
    feeBps: fee.isZero() ? 0 : charge.bps,
    feeAmount: fee.toString(),
    networkFeeLamports: feeText,
    memo: input.brand,
    inputMintDecimals,
    outputMintDecimals,
    roundTripOutAmount:
      input.inputMint === SOL_MINT && input.roundTrip !== false
        ? await roundTrip(pool, input.outputMint, outAmount)
        : undefined,
  };

  if (!input.userPublicKey) return quote;
  const user = new PublicKey(input.userPublicKey);
  const transaction = await pool.swap({
    inToken: new PublicKey(input.inputMint),
    outToken: new PublicKey(input.outputMint),
    inAmount: quoted.consumed,
    minOutAmount: quoted.minOut,
    lbPair: pool.pubkey,
    user,
    binArraysPubkey: quoted.binArrays,
  });
  if (input.assemble === false) return Object.assign(quote, { instructions: transaction.instructions, lookupTables: [] });
  const built = await buildSwapTransaction({
    user,
    instructions: transaction.instructions,
    brand: input.brand,
    fee,
    charge,
    outputMint: input.outputMint,
    minOut: minOutAmount,
  });
  return { ...quote, ...built };
}

async function roundTrip(pool: MeteoraPool, outputMint: string, tokensOut: BN): Promise<string | undefined> {
  try {
    const back = await swapQuote(pool, outputMint, tokensOut, 0);
    return back.grossOut.toString();
  } catch {
    return undefined;
  }
}

async function swapQuote(pool: MeteoraPool, inputMint: string, amountIn: BN, slippageBps: number) {
  const swapForY = pool.tokenX.publicKey.toBase58() === inputMint;
  if (!swapForY && pool.tokenY.publicKey.toBase58() !== inputMint) {
    throw new Error("This Meteora pool does not contain that mint.");
  }
  const bins = await pool.getBinArrayForSwap(swapForY);
  const quote = pool.swapQuote(amountIn, swapForY, new BN(slippageBps), bins, false);
  if (quote.outAmount.isZero()) throw new Error("Amount is too small for this pool.");
  return {
    grossOut: quote.outAmount,
    minOut: quote.minOutAmount,
    consumed: quote.consumedInAmount,
    binArrays: quote.binArraysPubkey,
    impact: quote.priceImpact.toString(),
  };
}

async function findPool(mintA: string, mintB: string): Promise<string> {
  const key = [mintA, mintB].sort().join(":");
  const cached = poolCache.get(key);
  if (cached && Date.now() - cached.at < 30_000) return cached.address;
  const filters = [`token_x=${mintA}&&token_y=${mintB}`, `token_x=${mintB}&&token_y=${mintA}`];
  const lists = await Promise.all(
    filters.map(async (filter) => {
      const response = await fetch(
        `https://dlmm.datapi.meteora.ag/pools?page=1&page_size=5&sort_by=tvl:desc&filter_by=${encodeURIComponent(filter)}`,
      );
      const body = (await response.json()) as { data?: Array<{ address?: string; tvl?: number; is_blacklisted?: boolean }> };
      return body.data ?? [];
    }),
  );
  const listed = lists.flat().filter((item) => item.address);
  const visible = listed.filter((item) => !item.is_blacklisted);
  const pool = (visible.length > 0 ? visible : listed).sort(
    (left, right) => Number(right.tvl ?? 0) - Number(left.tvl ?? 0),
  )[0];
  if (!pool?.address) throw new Error("No Meteora pool was found for this pair.");
  poolCache.set(key, { at: Date.now(), address: pool.address });
  return pool.address;
}

function decimalFraction(value: string): string {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "0";
  const fraction = number > 1 ? number / 100 : number;
  return String(fraction);
}
