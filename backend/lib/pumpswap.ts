import { NATIVE_MINT } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { canonicalPumpPoolPdaWithQuote } from "@pump-fun/pump-sdk";
import {
  buyQuoteInput,
  canonicalPumpPoolPda,
  computeFeesBps,
  OnlinePumpAmmSdk,
  PUMP_AMM_PROGRAM_ID,
  PUMP_AMM_SDK,
  sellBaseInput,
  type SwapSolanaState,
} from "@pump-fun/pump-swap-sdk";
import BN from "bn.js";
import { quoteBondingCurve, readCurveQuote } from "./curve";
import { chargeFor, feeOf } from "./fees";
import { buildSwapTransaction, connection, mintDecimals, priorityFeeMicroLamports } from "./trade";
import type { SwapFee, SwapQuote, SwapReceipt } from "./quote";

const CU_LIMIT = 300_000;
const SOL_MINT = NATIVE_MINT.toBase58();
const READ_ONLY_USER = new PublicKey("11111111111111111111111111111111");

const poolCache = new Map<string, PublicKey>();
const online = new OnlinePumpAmmSdk(connection);

export async function quotePumpSwap(input: {
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageBps: number;
  userPublicKey?: string;
  brand?: string;
  fee?: SwapFee;
  assemble?: boolean;
}): Promise<SwapQuote> {
  const networkFeePromise = priorityFeeMicroLamports();
  const inputMint = new PublicKey(input.inputMint);
  const outputMint = new PublicKey(input.outputMint);
  const payingSol = inputMint.equals(NATIVE_MINT);
  const receivingSol = outputMint.equals(NATIVE_MINT);
  if (payingSol === receivingSol) {
    if (payingSol) throw new Error("This version only swaps SOL with a PumpSwap token.");
    const user = input.userPublicKey ? new PublicKey(input.userPublicKey) : READ_ONLY_USER;
    return quoteTokenPair(input, inputMint, outputMint, user, networkFeePromise);
  }

  const baseMint = payingSol ? outputMint : inputMint;
  const user = input.userPublicKey ? new PublicKey(input.userPublicKey) : READ_ONLY_USER;
  const pool = await canonicalPool(baseMint);
  if (!pool) return quoteCurveOrIndexed(input, baseMint, payingSol, user, networkFeePromise);
  try {
    return await quoteAmm(input, pool, user, payingSol, networkFeePromise);
  } catch (error) {
    try {
      return await quoteBondingCurve(connection, input, baseMint, payingSol, user);
    } catch {
      throw error;
    }
  }
}

async function quoteCurveOrIndexed(
  input: Parameters<typeof quotePumpSwap>[0],
  baseMint: PublicKey,
  payingSol: boolean,
  user: PublicKey,
  networkFeePromise: Promise<number>,
): Promise<SwapQuote> {
  try {
    return await quoteBondingCurve(connection, input, baseMint, payingSol, user);
  } catch (error) {
    if (!worthIndex(error, baseMint)) throw error;
    const indexed = await indexedPool(baseMint);
    if (!indexed) throw error;
    return quoteAmm(input, indexed, user, payingSol, networkFeePromise);
  }
}

async function quoteTokenPair(
  input: Parameters<typeof quotePumpSwap>[0],
  inputMint: PublicKey,
  outputMint: PublicKey,
  user: PublicKey,
  networkFeePromise: Promise<number>,
): Promise<SwapQuote> {
  const candidates = [
    { base: outputMint, counter: inputMint, buying: true },
    { base: inputMint, counter: outputMint, buying: false },
  ];
  let last: unknown = new Error("This version only swaps SOL with a PumpSwap token.");
  for (const candidate of candidates) {
    const quote = await readCurveQuote(candidate.base.toBase58());
    if (quote !== candidate.counter.toBase58()) continue;
    try {
      return await quoteBondingCurve(connection, input, candidate.base, candidate.buying, user, candidate.counter);
    } catch (error) {
      last = error;
      const message = error instanceof Error ? error.message : "";
      if (!message.includes("filled its bonding curve") && !message.includes("migrating")) continue;
      const pool = canonicalPumpPoolPdaWithQuote(candidate.base, candidate.counter);
      const info = await connection.getAccountInfo(pool);
      if (!info?.owner.equals(PUMP_AMM_PROGRAM_ID)) continue;
      return quoteAmm(input, pool, user, candidate.buying, networkFeePromise, candidate.counter);
    }
  }
  throw last;
}

async function quoteAmm(
  input: Parameters<typeof quotePumpSwap>[0],
  pool: PublicKey,
  user: PublicKey,
  payingSol: boolean,
  networkFeePromise: Promise<number>,
  expectedQuote?: PublicKey,
): Promise<SwapQuote> {
  const state = await online.swapSolanaState(pool, user);
  const quoteMint = state.pool.quoteMint;
  const quoteIsSol = quoteMint.equals(NATIVE_MINT);
  if (expectedQuote ? !quoteMint.equals(expectedQuote) : !quoteIsSol) {
    throw new Error("This pool is not paired with SOL.");
  }
  const quoteDecimals = quoteIsSol ? 9 : await mintDecimals(quoteMint.toBase58());

  const amount = new BN(input.amount);
  const slippage = input.slippageBps / 100;
  const args = poolArgs(state);
  const charge = chargeFor(input);
  const inputFee = quoteIsSol && payingSol ? feeOf(amount, charge.bps) : new BN(0);
  if (payingSol && inputFee.gtn(0) && inputFee.gte(amount)) {
    throw new Error("Amount is too small for the swap fee.");
  }
  const swapAmount = payingSol ? amount.sub(inputFee) : amount;
  const buy = payingSol ? buyQuoteInput({ ...args, quote: swapAmount, slippage }) : null;
  const sell = payingSol ? null : sellBaseInput({ ...args, base: swapAmount, slippage });
  const grossOut = buy ? buy.base : sell!.uiQuote;
  const outputFee = quoteIsSol && !payingSol ? feeOf(grossOut, charge.bps) : new BN(0);
  if (grossOut.isZero() || (!payingSol && outputFee.gte(sell!.minQuote))) {
    throw new Error("Amount is too small for this pool.");
  }
  const outAmount = grossOut.sub(outputFee);
  const minOutAmount = buy
    ? buy.base.muln(10_000 - input.slippageBps).divn(10_000)
    : sell!.minQuote.sub(outputFee);
  if (minOutAmount.isZero()) throw new Error("Amount is too small for this pool.");
  const maxInAmount = buy ? buy.maxQuote.add(inputFee) : amount;
  const fee = inputFee.add(outputFee);

  const quote: SwapQuote = {
    side: payingSol ? "buy" : "sell",
    inAmount: amount.toString(),
    outAmount: outAmount.toString(),
    minOutAmount: minOutAmount.toString(),
    maxInAmount: maxInAmount.toString(),
    priceImpactPct: priceImpact(payingSol, swapAmount, grossOut, state),
    pool: pool.toBase58(),
    programId: PUMP_AMM_PROGRAM_ID.toBase58(),
    venue: "PumpSwap",
    receipt: receipt(state),
    roundTripOutAmount: buy ? roundTripSol(args, buy.base, buy.internalQuoteWithoutFees, slippage) : undefined,
    feeBps: fee.isZero() ? 0 : charge.bps,
    feeAmount: fee.toString(),
    memo: input.brand,
    inputMintDecimals: payingSol ? quoteDecimals : state.baseMintAccount.decimals,
    outputMintDecimals: payingSol ? state.baseMintAccount.decimals : quoteDecimals,
    networkFeeLamports: String(5_000 + Math.floor(((await networkFeePromise) * CU_LIMIT) / 1_000_000)),
  };

  if (!input.userPublicKey) return quote;

  const instructions = payingSol
    ? await PUMP_AMM_SDK.buyQuoteInput(state, swapAmount, slippage)
    : await PUMP_AMM_SDK.sellBaseInput(state, swapAmount, slippage);
  const programs = instructions.map((instruction) => instruction.programId.toBase58());
  if (!programs.includes(quote.programId)) {
    throw new Error("The PumpSwap instruction was not created.");
  }

  if (input.assemble === false) return Object.assign(quote, { instructions, lookupTables: [] });

  const built = await buildSwapTransaction({
    user,
    instructions,
    brand: input.brand,
    fee,
    charge,
    outputMint: input.outputMint,
    minOut: minOutAmount,
  });

  return {
    ...quote,
    ...built,
  };
}

function receipt(state: SwapSolanaState): SwapReceipt {
  const fees = computeFeesBps({
    globalConfig: state.globalConfig,
    feeConfig: state.feeConfig,
    creator: state.pool.creator,
    baseMintSupply: new BN(state.baseMintAccount.supply.toString()),
    baseMint: state.baseMint,
    baseReserve: state.poolBaseAmount,
    quoteReserve: state.poolQuoteAmount.add(state.pool.virtualQuoteReserves),
    quoteMint: state.pool.quoteMint,
    isMayhemMode: state.pool.isMayhemMode,
    creatorFeeBps: state.pool.creatorFeeBps,
  });
  const creator = state.pool.coinCreator.equals(PublicKey.default) ? state.pool.creator : state.pool.coinCreator;
  return {
    venue: "PumpSwap",
    graduated: true,
    mayhem: state.pool.isMayhemMode,
    cashback: state.pool.isCashbackCoin,
    creatorFeeBps: fees.creatorFeeBps.toNumber(),
    creator: creator.toBase58(),
  };
}

function roundTripSol(
  args: ReturnType<typeof poolArgs>,
  tokensOut: BN,
  solIntoPool: BN,
  slippage: number,
): string | undefined {
  const nextBase = args.baseReserve.sub(tokensOut);
  if (nextBase.lten(0)) return undefined;
  try {
    const sold = sellBaseInput({
      ...args,
      baseReserve: nextBase,
      quoteReserve: args.quoteReserve.add(solIntoPool),
      base: tokensOut,
      slippage,
    });
    return sold.uiQuote.toString();
  } catch {
    return undefined;
  }
}

async function canonicalPool(baseMint: PublicKey): Promise<PublicKey | null> {
  const cached = poolCache.get(baseMint.toBase58());
  if (cached) return cached;
  const canonical = canonicalPumpPoolPda(baseMint);
  const info = await connection.getAccountInfo(canonical);
  if (!info?.owner.equals(PUMP_AMM_PROGRAM_ID)) return null;
  poolCache.set(baseMint.toBase58(), canonical);
  return canonical;
}

function worthIndex(error: unknown, mint: PublicKey): boolean {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("migrating") || message.includes("filled its bonding curve")) return true;
  return message.includes("does not have a PumpSwap pool yet") && mint.toBase58().endsWith("pump");
}

async function indexedPool(baseMint: PublicKey): Promise<PublicKey | null> {
  try {
    const response = await fetch(`https://api.dexscreener.com/token-pairs/v1/solana/${baseMint.toBase58()}`, {
      signal: AbortSignal.timeout(1_500),
    });
    if (!response.ok) return null;
    const pairs = (await response.json()) as Array<{
      dexId?: string;
      pairAddress?: string;
      quoteToken?: { address?: string };
      liquidity?: { usd?: number };
    }>;
    const match = pairs
      .filter((pair) => pair.dexId === "pumpswap" && pair.quoteToken?.address === SOL_MINT && pair.pairAddress)
      .sort((left, right) => (right.liquidity?.usd ?? 0) - (left.liquidity?.usd ?? 0))[0];
    if (!match?.pairAddress) return null;
    const pool = new PublicKey(match.pairAddress);
    const info = await connection.getAccountInfo(pool);
    if (!info?.owner.equals(PUMP_AMM_PROGRAM_ID)) return null;
    poolCache.set(baseMint.toBase58(), pool);
    return pool;
  } catch {
    return null;
  }
}

function poolArgs(state: SwapSolanaState) {
  return {
    baseReserve: state.poolBaseAmount,
    quoteReserve: state.poolQuoteAmount,
    virtualQuoteReserves: state.pool.virtualQuoteReserves,
    globalConfig: state.globalConfig,
    feeConfig: state.feeConfig,
    baseMint: state.baseMint,
    baseMintAccount: state.baseMintAccount,
    coinCreator: state.pool.coinCreator,
    creator: state.pool.creator,
    quoteMint: state.pool.quoteMint,
    isMayhemMode: state.pool.isMayhemMode,
    creatorFeeBps: state.pool.creatorFeeBps,
  };
}

function priceImpact(payingSol: boolean, amountIn: BN, amountOut: BN, state: SwapSolanaState): string {
  const reserveIn = payingSol ? state.poolQuoteAmount : state.poolBaseAmount;
  const reserveOut = payingSol ? state.poolBaseAmount : state.poolQuoteAmount;
  if (reserveIn.isZero() || amountOut.isZero()) return "0";
  const midOut = amountIn.mul(reserveOut).div(reserveIn);
  if (midOut.lte(amountOut)) return "0";
  return ratio(midOut.sub(amountOut), midOut);
}

function ratio(numerator: BN, denominator: BN): string {
  const scale = new BN(1_000_000_000);
  const scaled = numerator.mul(scale).div(denominator);
  const whole = scaled.div(scale).toString();
  const fraction = scaled.mod(scale).toString().padStart(9, "0").replace(/0+$/, "");
  return fraction.length > 0 ? `${whole}.${fraction}` : whole;
}

export { SOL_MINT };
