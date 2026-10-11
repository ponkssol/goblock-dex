import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import type { ActivationType, PoolConfig, Swap2Params, VirtualPool } from "@meteora-ag/dynamic-bonding-curve-sdk";
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

type CurveSdk = typeof import("@meteora-ag/dynamic-bonding-curve-sdk");
type CurveClient = ReturnType<CurveSdk["DynamicBondingCurveClient"]["create"]>;

let sdkPromise: Promise<CurveSdk> | null = null;
let clientPromise: Promise<CurveClient> | null = null;

function loadSdk() {
  sdkPromise ??= import("@meteora-ag/dynamic-bonding-curve-sdk");
  return sdkPromise;
}

function curveClient() {
  clientPromise ??= loadSdk().then((sdk) => sdk.DynamicBondingCurveClient.create(connection, "confirmed"));
  return clientPromise;
}

type CurveState = {
  config: PublicKey;
  baseMint: PublicKey;
  isMigrated: number;
};

export async function quoteDbc(input: SwapOrderInput): Promise<SwapQuote> {
  const amount = new BN(input.amount);
  const linkFee = input.assemble !== false && Boolean(input.brandWallet);
  const legs = solFees(input.inputMint, input.outputMint, amount, linkFee);
  const sdk = await loadSdk();
  const opened = await openPool(input.inputMint, input.outputMint);
  const currentPoint = await sdk.getCurrentPoint(connection, opened.activation);
  const quoted = await quoteSwap(opened, input.inputMint, legs.swapIn, input.slippageBps, currentPoint);
  const { outAmount, outputFee } = outputAfterFee(quoted.gross, legs.outputIsSol, linkFee);
  const minOutAmount = outputAfterFee(quoted.min, legs.outputIsSol, linkFee).outAmount;
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
    priceImpactPct: "0",
    pool: opened.address.toBase58(),
    programId: String(sdk.DYNAMIC_BONDING_CURVE_PROGRAM_ID),
    venue: "Meteora",
    receipt: venueReceipt("Meteora"),
    feeBps: fee.isZero() ? 0 : 5,
    feeAmount: fee.toString(),
    networkFeeLamports: feeText,
    memo: input.brand,
    inputMintDecimals,
    outputMintDecimals,
    roundTripOutAmount:
      input.inputMint === SOL_MINT && input.roundTrip !== false
        ? await reverse(opened, input.outputMint, outAmount, currentPoint)
        : undefined,
  };

  if (!input.userPublicKey) return quote;
  const user = new PublicKey(input.userPublicKey);
  const swapBaseForQuote = input.inputMint === opened.base.toBase58();
  const transaction = await swapTransaction(opened, user, swapBaseForQuote, legs.swapIn, quoted.min);
  if (input.assemble === false) return Object.assign(quote, { instructions: transaction.instructions, lookupTables: [] });
  const built = await buildSwapTransaction({
    user,
    instructions: transaction.instructions,
    brand: input.brand,
    brandWallet: input.brandWallet,
    fee,
    outputMint: input.outputMint,
    minOut: minOutAmount,
  });
  return { ...quote, ...built };
}

async function reverse(opened: Opened, inputMint: string, amountIn: BN, currentPoint: BN): Promise<string | undefined> {
  try {
    return (await quoteSwap(opened, inputMint, amountIn, 0, currentPoint)).gross.toString();
  } catch {
    return undefined;
  }
}

async function quoteSwap(opened: Opened, inputMint: string, amountIn: BN, slippageBps: number, currentPoint: BN) {
  const sdk = await loadSdk();
  const dbc = await curveClient();
  const quoted = dbc.pool.swapQuote2({
    virtualPool: opened.pool,
    config: opened.config,
    swapBaseForQuote: inputMint === opened.base.toBase58(),
    swapMode: sdk.SwapMode.ExactIn,
    amountIn,
    slippageBps,
    hasReferral: false,
    eligibleForFirstSwapWithMinFee: false,
    currentPoint,
  });
  const gross = quoted.outputAmount;
  const min = quoted.minimumAmountOut ?? gross.muln(10_000 - slippageBps).divn(10_000);
  if (gross.isZero()) throw new Error("Amount is too small for this pool.");
  return { gross, min };
}

async function swapTransaction(
  opened: Opened,
  user: PublicKey,
  swapBaseForQuote: boolean,
  amountIn: BN,
  minimumAmountOut: BN,
) {
  const sdk = await loadSdk();
  const params: Swap2Params = {
    owner: user,
    payer: user,
    pool: opened.address,
    swapBaseForQuote,
    swapMode: sdk.SwapMode.ExactIn,
    amountIn,
    minimumAmountOut,
    referralTokenAccount: null,
  };
  const dbc = await curveClient();
  try {
    return await dbc.pool.swap2(params);
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "";
    if (!message.toLowerCase().includes("transfer hook")) throw caught;
    return dbc.pool.swap2WithTransferHook(params);
  }
}

type Opened = {
  address: PublicKey;
  pool: VirtualPool;
  config: PoolConfig;
  base: PublicKey;
  activation: ActivationType;
};

async function openPool(inputMint: string, outputMint: string): Promise<Opened> {
  const dbc = await curveClient();
  for (const baseMint of [inputMint, outputMint]) {
    const found = await dbc.state.getPoolByBaseMint(baseMint);
    if (!found) continue;
    const state = found.account.poolState as CurveState;
    if (state.isMigrated) continue;
    const config = await dbc.state.getPoolConfig(state.config);
    if (!config?.quoteMint) continue;
    const mints = [state.baseMint.toBase58(), config.quoteMint.toBase58()];
    if (!mints.includes(inputMint) || !mints.includes(outputMint)) continue;
    return {
      address: found.publicKey,
      pool: found.account,
      config,
      base: state.baseMint,
      activation: config.activationType as ActivationType,
    };
  }
  throw new Error("No Meteora pool was found for this pair.");
}
