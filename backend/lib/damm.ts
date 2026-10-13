import { PublicKey, type TransactionInstruction } from "@solana/web3.js";
import { ActivationType, CpAmm, getCurrentPoint, getTokenProgram, SwapMode } from "@meteora-ag/cp-amm-sdk";
import { AmmImpl, PROGRAM_ID as DAMM_V1_PROGRAM_ID } from "@meteora-ag/dynamic-amm-sdk";
import BN from "bn.js";
import { chargeFor } from "./fees";
import type { SwapOrderInput, SwapQuote } from "./quote";
import { SOL_MINT } from "./tokens";
import {
  buildSwapTransaction,
  connection,
  mintDecimals,
  networkFeeLamports,
  outputAfterFee,
  solFees,
  venueReceipt,
} from "./trade";

const DAMM_V2_PROGRAM_ID = "cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG";
const cpAmm = () => new CpAmm(connection);

type DammState = {
  tokenAMint: PublicKey;
  tokenBMint: PublicKey;
  tokenAVault: PublicKey;
  tokenBVault: PublicKey;
  tokenAFlag: number;
  tokenBFlag: number;
  activationType: ActivationType;
};

export function quoteDammV2(input: SwapOrderInput): Promise<SwapQuote> {
  return quoteDamm(input, "v2");
}

export function quoteDammV1(input: SwapOrderInput): Promise<SwapQuote> {
  return quoteDamm(input, "v1");
}

async function quoteDamm(input: SwapOrderInput, version: "v1" | "v2"): Promise<SwapQuote> {
  const amount = new BN(input.amount);
  const charge = chargeFor(input);
  const legs = solFees(input.inputMint, input.outputMint, amount, charge.bps);
  const quoted = version === "v2" ? await quoteV2(input, legs.swapIn) : await quoteV1(input, legs.swapIn);
  const { outAmount, outputFee } = outputAfterFee(quoted.gross, legs.outputIsSol, charge.bps);
  const minOutAmount = outputAfterFee(quoted.min, legs.outputIsSol, charge.bps).outAmount;
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
    pool: quoted.pool,
    programId: version === "v2" ? DAMM_V2_PROGRAM_ID : String(DAMM_V1_PROGRAM_ID),
    venue: "Meteora",
    receipt: venueReceipt("Meteora"),
    feeBps: fee.isZero() ? 0 : charge.bps,
    feeAmount: fee.toString(),
    networkFeeLamports: feeText,
    memo: input.brand,
    inputMintDecimals,
    outputMintDecimals,
    roundTripOutAmount:
      input.inputMint === SOL_MINT && input.roundTrip !== false ? await quoted.roundTrip(outAmount) : undefined,
  };

  if (!input.userPublicKey) return quote;
  const user = new PublicKey(input.userPublicKey);
  const instructions = await quoted.instructions(user);
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
  return { ...quote, ...built };
}

async function quoteV2(input: SwapOrderInput, amountIn: BN) {
  const address = await findV2Pool(input.inputMint, input.outputMint);
  const pool = new PublicKey(address);
  const amm = cpAmm();
  const state = (await amm.fetchPoolState(pool)) as DammState;
  const currentPoint = await getCurrentPoint(connection, state.activationType);
  const [decimalsA, decimalsB] = await Promise.all([
    mintDecimals(state.tokenAMint.toBase58()),
    mintDecimals(state.tokenBMint.toBase58()),
  ]);
  const quoted = amm.getQuote2({
    poolState: state as never,
    inputTokenMint: new PublicKey(input.inputMint),
    amountIn,
    slippage: input.slippageBps / 10_000,
    swapMode: SwapMode.ExactIn,
    currentPoint,
    tokenADecimal: decimalsA,
    tokenBDecimal: decimalsB,
    hasReferral: false,
  });
  const gross = quoted.outputAmount;
  const min = quoted.minimumAmountOut ?? gross.muln(10_000 - input.slippageBps).divn(10_000);
  if (gross.isZero()) throw new Error("Amount is too small for this pool.");
  return {
    pool: address,
    gross,
    min,
    impact: impactText(quoted.priceImpact.toString()),
    roundTrip: async (tokensOut: BN) => {
      try {
        const back = amm.getQuote2({
          poolState: state as never,
          inputTokenMint: state.tokenAMint.toBase58() === input.inputMint ? state.tokenBMint : state.tokenAMint,
          amountIn: tokensOut,
          slippage: 0,
          swapMode: SwapMode.ExactIn,
          currentPoint,
          tokenADecimal: decimalsA,
          tokenBDecimal: decimalsB,
          hasReferral: false,
        });
        return back.outputAmount.toString();
      } catch {
        return undefined;
      }
    },
    instructions: async (user: PublicKey) => {
      const transaction = await amm.swap2({
        payer: user,
        pool,
        inputTokenMint: new PublicKey(input.inputMint),
        outputTokenMint: new PublicKey(input.outputMint),
        tokenAMint: state.tokenAMint,
        tokenBMint: state.tokenBMint,
        tokenAVault: state.tokenAVault,
        tokenBVault: state.tokenBVault,
        tokenAProgram: getTokenProgram(state.tokenAFlag),
        tokenBProgram: getTokenProgram(state.tokenBFlag),
        referralTokenAccount: null,
        poolState: state as never,
        swapMode: SwapMode.ExactIn,
        amountIn,
        minimumAmountOut: min,
      });
      return transaction.instructions;
    },
  };
}

async function quoteV1(input: SwapOrderInput, amountIn: BN) {
  const scan = input.inputMint === SOL_MINT ? input.outputMint : input.inputMint;
  const pools = await AmmImpl.searchPoolsByToken(connection as never, new PublicKey(scan));
  const match = pools.find((pool) => {
    const mints = [pool.account.tokenAMint.toBase58(), pool.account.tokenBMint.toBase58()];
    return pool.account.enabled && mints.includes(input.inputMint) && mints.includes(input.outputMint);
  });
  if (!match) throw new Error("No Meteora pool was found for this pair.");
  const amm = await AmmImpl.create(connection as never, match.publicKey);
  const quoted = amm.getSwapQuote(new PublicKey(input.inputMint), amountIn, input.slippageBps / 100);
  if (quoted.swapOutAmount.isZero()) throw new Error("Amount is too small for this pool.");
  return {
    pool: match.publicKey.toBase58(),
    gross: quoted.swapOutAmount,
    min: quoted.minSwapOutAmount,
    impact: impactText(quoted.priceImpact.toString()),
    roundTrip: async (tokensOut: BN) => {
      try {
        return amm.getSwapQuote(new PublicKey(input.outputMint), tokensOut, 0).swapOutAmount.toString();
      } catch {
        return undefined;
      }
    },
    instructions: (user: PublicKey): Promise<TransactionInstruction[]> =>
      amm
        .swap(user, new PublicKey(input.inputMint), amountIn, quoted.minSwapOutAmount)
        .then((transaction) => transaction.instructions),
  };
}

async function findV2Pool(mintA: string, mintB: string): Promise<string> {
  const filters = [`token_x=${mintA}&&token_y=${mintB}`, `token_x=${mintB}&&token_y=${mintA}`];
  const lists = await Promise.all(
    filters.map(async (filter) => {
      const response = await fetch(
        `https://damm-v2.datapi.meteora.ag/pools?page=1&page_size=5&sort_by=tvl:desc&filter_by=${encodeURIComponent(filter)}`,
        { signal: AbortSignal.timeout(2_500) },
      );
      if (!response.ok) return [];
      const body = (await response.json()) as { data?: ListedPool[] };
      return body.data ?? [];
    }),
  );
  const pool = pickListed(lists.flat());
  if (!pool?.address) throw new Error("No Meteora pool was found for this pair.");
  return pool.address;
}

type ListedPool = { address?: string; is_blacklisted?: boolean; tvl?: number };

function pickListed(pools: ListedPool[]): ListedPool | undefined {
  const listed = pools.filter((pool) => pool.address);
  const visible = listed.filter((pool) => !pool.is_blacklisted);
  return (visible.length > 0 ? visible : listed).sort((left, right) => Number(right.tvl ?? 0) - Number(left.tvl ?? 0))[0];
}

function impactText(value: string): string {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "0";
  return String(number > 1 ? number / 100 : number);
}
