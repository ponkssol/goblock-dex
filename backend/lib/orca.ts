import { PublicKey, VersionedTransaction } from "@solana/web3.js";
import { Percentage } from "@orca-so/common-sdk";
import {
  buildWhirlpoolClient,
  ORCA_WHIRLPOOL_PROGRAM_ID,
  swapQuoteByInputToken,
  WhirlpoolContext,
  type Whirlpool,
} from "@orca-so/whirlpools-sdk";
import BN from "bn.js";
import type { SwapOrderInput, SwapQuote } from "./quote";
import { SOL_MINT } from "./tokens";
import {
  buildSwapTransaction,
  connection,
  impactFraction,
  instructionsFromVersioned,
  mintDecimals,
  networkFeeLamports,
  outputAfterFee,
  solFees,
  venueReceipt,
} from "./trade";

const ORCA_PROGRAM_ID = ORCA_WHIRLPOOL_PROGRAM_ID.toBase58();
const poolCache = new Map<string, { at: number; address: string }>();

export async function quoteOrca(input: SwapOrderInput): Promise<SwapQuote> {
  const amount = new BN(input.amount);
  const linkFee = input.assemble !== false && Boolean(input.brandWallet);
  const legs = solFees(input.inputMint, input.outputMint, amount, linkFee);
  const address = await findPool(input.inputMint, input.outputMint);
  const user = new PublicKey(input.userPublicKey ?? "11111111111111111111111111111111");
  const opened = await openWhirlpool(address, user);
  const quoted = await swapQuote(opened.pool, opened.ctx, input.inputMint, legs.swapIn, input.slippageBps);
  const { outAmount, outputFee } = outputAfterFee(quoted.grossOut, legs.outputIsSol, linkFee);
  const minOutAmount = outputAfterFee(quoted.minOut, legs.outputIsSol, linkFee).outAmount;
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
    priceImpactPct: quoted.impact,
    pool: address,
    programId: ORCA_PROGRAM_ID,
    venue: "Orca",
    receipt: venueReceipt("Orca"),
    feeBps: fee.isZero() ? 0 : 5,
    feeAmount: fee.toString(),
    networkFeeLamports: feeText,
    memo: input.brand,
    inputMintDecimals,
    outputMintDecimals,
    roundTripOutAmount:
      input.inputMint === SOL_MINT && input.roundTrip !== false
        ? await roundTrip(opened.pool, opened.ctx, input.outputMint, outAmount)
        : undefined,
  };

  if (!input.userPublicKey) return quote;
  const builder = await opened.pool.swap(quoted.sdkQuote, user);
  const built = await builder.build();
  const serialized = built.transaction.serialize();
  const unpacked = await instructionsFromVersioned(VersionedTransaction.deserialize(serialized));
  if (input.assemble === false) return Object.assign(quote, unpacked);
  const transaction = await buildSwapTransaction({
    user,
    instructions: unpacked.instructions,
    lookupTables: unpacked.lookupTables,
    brand: input.brand,
    brandWallet: input.brandWallet,
    fee,
    outputMint: input.outputMint,
    minOut: minOutAmount,
  });
  return { ...quote, ...transaction };
}

async function roundTrip(
  pool: Whirlpool,
  ctx: WhirlpoolContext,
  outputMint: string,
  tokensOut: BN,
): Promise<string | undefined> {
  try {
    const back = await swapQuote(pool, ctx, outputMint, tokensOut, 0);
    return back.grossOut.toString();
  } catch {
    return undefined;
  }
}

async function swapQuote(pool: Whirlpool, ctx: WhirlpoolContext, inputMint: string, amountIn: BN, slippageBps: number) {
  const data = pool.getData();
  const quote = await swapQuoteByInputToken(
    pool,
    new PublicKey(inputMint),
    amountIn,
    Percentage.fromFraction(slippageBps, 10_000),
    ctx.program.programId,
    ctx.fetcher,
  );
  if (quote.estimatedAmountOut.isZero()) throw new Error("Amount is too small for this pool.");
  return {
    sdkQuote: quote,
    grossOut: quote.estimatedAmountOut,
    minOut: quote.otherAmountThreshold,
    impact: spotImpact(data.sqrtPrice, quote.aToB, amountIn, quote.estimatedAmountOut),
  };
}

function spotImpact(sqrtPrice: BN, aToB: boolean, amountIn: BN, amountOut: BN): string {
  const squared = sqrtPrice.mul(sqrtPrice);
  const scale = new BN(2).pow(new BN(128));
  if (squared.isZero()) return "0";
  const midOut = aToB ? amountIn.mul(squared).div(scale) : amountIn.mul(scale).div(squared);
  return impactFraction(midOut, amountOut);
}

async function openWhirlpool(address: string, user: PublicKey): Promise<{ pool: Whirlpool; ctx: WhirlpoolContext }> {
  const wallet = {
    publicKey: user,
    signTransaction: async <T>(transaction: T) => transaction,
    signAllTransactions: async <T>(transactions: T[]) => transactions,
  };
  const ctx = WhirlpoolContext.from(connection, wallet, undefined, undefined, {
    accountResolverOptions: {
      createWrappedSolAccountMethod: "ata",
      allowPDAOwnerAddress: false,
    },
  });
  const pool = await buildWhirlpoolClient(ctx).getPool(new PublicKey(address));
  return { pool, ctx };
}

async function findPool(mintA: string, mintB: string): Promise<string> {
  const key = [mintA, mintB].sort().join(":");
  const cached = poolCache.get(key);
  if (cached && Date.now() - cached.at < 30_000) return cached.address;
  const params = new URLSearchParams({
    tokensBothOf: `${mintA},${mintB}`,
    size: "5",
    sortBy: "tvl",
    sortDirection: "desc",
  });
  const response = await fetch(`https://api.orca.so/v2/solana/pools?${params}`);
  const body = (await response.json()) as { data?: { address?: string; tvl?: string }[] };
  const pool = body.data?.find((item) => item.address);
  if (!pool?.address) throw new Error("No Orca pool was found for this pair.");
  poolCache.set(key, { at: Date.now(), address: pool.address });
  return pool.address;
}
