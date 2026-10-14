import {
  NATIVE_MINT,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";
import {
  bondingCurvePda,
  computeFeesBps,
  getBuyTokenAmountFromSolAmount,
  getBuyV3TokenAmountFromQuoteAmount,
  getSellSolAmountFromTokenAmount,
  OnlinePumpSdk,
  PUMP_PROGRAM_ID,
  PUMP_SDK,
  type BondingCurve,
} from "@pump-fun/pump-sdk";
import BN from "bn.js";
import { chargeFor, feeOf } from "./fees";
import { buildSwapTransaction, connection, priorityFeeMicroLamports } from "./trade";
import type { SwapFee, SwapQuote } from "./quote";

const CU_LIMIT = 300_000;

export async function quoteBondingCurve(
  connection: Connection,
  input: {
    amount: string;
    slippageBps: number;
    userPublicKey?: string;
    brand?: string;
    fee?: SwapFee;
    assemble?: boolean;
  },
  baseMint: PublicKey,
  payingSol: boolean,
  user: PublicKey,
  counterMint: PublicKey = NATIVE_MINT,
): Promise<SwapQuote> {
  const curveAccount = await connection.getAccountInfo(bondingCurvePda(baseMint));
  if (!curveAccount?.owner.equals(PUMP_PROGRAM_ID) || curveAccount.data.length < 49) {
    throw new Error("This token does not have a PumpSwap pool yet.");
  }

  const mintAccount = await connection.getAccountInfo(baseMint);
  const tokenProgram = mintAccount?.owner;
  if (
    !mintAccount ||
    !tokenProgram ||
    (!tokenProgram.equals(TOKEN_PROGRAM_ID) && !tokenProgram.equals(TOKEN_2022_PROGRAM_ID))
  ) {
    throw new Error("This token does not have a PumpSwap pool yet.");
  }

  const online = new OnlinePumpSdk(connection);
  const [global, feeConfig, buyState] = await Promise.all([
    online.fetchGlobal(),
    online.fetchFeeConfig().catch(() => null),
    online.fetchBuyState(baseMint, user, tokenProgram),
  ]);
  const curve = buyState.bondingCurve;
  const quoteMint = buyState.quoteMint;
  const quoteIsSol = quoteMint.equals(NATIVE_MINT);
  if (!counterMint.equals(quoteMint)) throw new Error("This token is not quoted in SOL.");
  if (curve.virtualTokenReserves.isZero() && curve.realTokenReserves.isZero()) {
    throw new Error("This token is migrating to PumpSwap. Try again in a moment.");
  }
  const openSol = quoteIsSol && !curve.complete && !curve.realTokenReserves.isZero();

  const amount = new BN(input.amount);
  const slippageBps = input.slippageBps;
  const charge = chargeFor(input, true);
  const inputFee = payingSol && quoteIsSol ? feeOf(amount, charge.bps) : new BN(0);
  if (payingSol && inputFee.gtn(0) && inputFee.gte(amount)) throw new Error("Amount is too small for the swap fee.");
  const swapAmount = payingSol ? amount.sub(inputFee) : amount;
  const decimals = mintAccount.data[44] ?? 6;
  const quoteDecimals = quoteIsSol ? 9 : ((await connection.getAccountInfo(quoteMint))?.data[44] ?? 6);

  const tokens = payingSol ? buyTokens(openSol, global, feeConfig, curve, swapAmount, quoteMint, buyState.curveBaseTokenBalance) : swapAmount;
  let solOut = new BN(0);
  if (!payingSol) {
    try {
      solOut = getSellSolAmountFromTokenAmount({
        global,
        feeConfig,
        mintSupply: curve.tokenTotalSupply,
        bondingCurve: curve,
        amount: swapAmount,
      });
    } catch {
      solOut = new BN(0);
    }
  }
  const curveOpen = !curve.complete && !curve.virtualTokenReserves.isZero();
  if ((payingSol && tokens.isZero()) || (!payingSol && solOut.lten(0))) {
    throw new Error(
      curveOpen ? "Amount is too small for this pool." : "This token has filled its bonding curve and is waiting to migrate.",
    );
  }

  const outputFee = !payingSol && quoteIsSol ? feeOf(solOut, charge.bps) : new BN(0);
  const grossOut = payingSol ? tokens : solOut;
  const outAmount = grossOut.sub(outputFee);
  if (outAmount.lten(0) || (!payingSol && outputFee.gte(solOut))) {
    throw new Error("Amount is too small for the swap fee.");
  }
  const minOutAmount = floorBps(outAmount, 10_000 - slippageBps);
  if (minOutAmount.isZero()) throw new Error("Amount is too small for this pool.");

  const fees = computeFeesBps({
    global,
    feeConfig,
    mintSupply: curve.tokenTotalSupply,
    virtualQuoteReserves: curve.virtualQuoteReserves,
    virtualTokenReserves: curve.virtualTokenReserves,
    quoteMint,
    creatorFeeBps: curve.creatorFeeBps,
  });
  const creatorFeeBps = curve.creator.equals(PublicKey.default) ? 0 : fees.creatorFeeBps.toNumber();
  const fee = inputFee.add(outputFee);
  const microLamports = await priorityFeeMicroLamports();

  const quote: SwapQuote = {
    side: payingSol ? "buy" : "sell",
    inAmount: amount.toString(),
    outAmount: outAmount.toString(),
    minOutAmount: minOutAmount.toString(),
    maxInAmount: amount.toString(),
    priceImpactPct: priceImpact(payingSol, swapAmount, payingSol ? tokens : solOut, curve),
    pool: bondingCurvePda(baseMint).toBase58(),
    programId: PUMP_PROGRAM_ID.toBase58(),
    venue: "Bonding curve",
    receipt: {
      venue: "Bonding curve",
      graduated: false,
      mayhem: curve.isMayhemMode,
      cashback: curve.isCashbackCoin,
      creatorFeeBps,
      creator: curve.creator.toBase58(),
    },
    roundTripOutAmount: openSol && payingSol ? roundTripSol(global, feeConfig, curve, swapAmount, tokens) : undefined,
    feeBps: fee.isZero() ? 0 : charge.bps,
    feeAmount: fee.toString(),
    memo: input.brand,
    inputMintDecimals: payingSol ? quoteDecimals : decimals,
    outputMintDecimals: payingSol ? decimals : quoteDecimals,
    networkFeeLamports: String(5_000 + Math.floor((microLamports * CU_LIMIT) / 1_000_000)),
  };

  if (!input.userPublicKey) return quote;

  if (!buyState.bondingCurveAccountInfo) {
    throw new Error("This token does not have a PumpSwap pool yet.");
  }
  if (!payingSol && !buyState.associatedUserAccountInfo) {
    throw new Error("This wallet does not hold that token.");
  }

  const instructions = openSol
    ? await legacyInstructions(payingSol, global, buyState, curve, baseMint, user, minOutAmount, swapAmount, outputFee, tokenProgram)
    : await quotedInstructions(
        payingSol,
        curve.isCashbackCoin,
        global,
        buyState,
        curve,
        baseMint,
        user,
        minOutAmount,
        swapAmount,
        outputFee,
        tokenProgram,
      );

  if (input.assemble === false) return Object.assign(quote, { instructions, lookupTables: [] });

  const built = await buildSwapTransaction({
    user,
    instructions,
    brand: input.brand,
    fee,
    charge,
    outputMint: payingSol ? baseMint.toBase58() : quoteMint.toBase58(),
    minOut: minOutAmount,
  });

  return {
    ...quote,
    ...built,
  };
}

export async function readCurveQuote(mint: string): Promise<string | null> {
  try {
    const info = await connection.getAccountInfo(bondingCurvePda(new PublicKey(mint)));
    if (!info?.owner.equals(PUMP_PROGRAM_ID) || info.data.length < 49) return null;
    const curve = PUMP_SDK.decodeBondingCurve(info);
    const quote = curve.quoteMint.equals(PublicKey.default) ? NATIVE_MINT : curve.quoteMint;
    return quote.toBase58();
  } catch {
    return null;
  }
}

function buyTokens(
  openSol: boolean,
  global: Parameters<typeof getBuyTokenAmountFromSolAmount>[0]["global"],
  feeConfig: Parameters<typeof getBuyTokenAmountFromSolAmount>[0]["feeConfig"],
  curve: BondingCurve,
  swapAmount: BN,
  quoteMint: PublicKey,
  curveBaseTokenBalance: BN,
): BN {
  if (openSol || curve.isCashbackCoin || !feeConfig) {
    return getBuyTokenAmountFromSolAmount({
      global,
      feeConfig,
      mintSupply: curve.tokenTotalSupply,
      bondingCurve: curve,
      amount: swapAmount,
      quoteMint,
    });
  }
  try {
    return getBuyV3TokenAmountFromQuoteAmount({
      global,
      feeConfig,
      mintSupply: curve.tokenTotalSupply,
      bondingCurve: curve,
      amount: swapAmount,
      curveBaseTokenBalance,
    });
  } catch {
    return new BN(0);
  }
}

async function legacyInstructions(
  payingSol: boolean,
  global: Parameters<typeof getBuyTokenAmountFromSolAmount>[0]["global"],
  buyState: Awaited<ReturnType<OnlinePumpSdk["fetchBuyState"]>>,
  curve: BondingCurve,
  baseMint: PublicKey,
  user: PublicKey,
  minOutAmount: BN,
  swapAmount: BN,
  outputFee: BN,
  tokenProgram: PublicKey,
) {
  if (!buyState.bondingCurveAccountInfo) throw new Error("This token does not have a PumpSwap pool yet.");
  return payingSol
    ? PUMP_SDK.buyInstructions({
        global,
        bondingCurveAccountInfo: buyState.bondingCurveAccountInfo,
        bondingCurve: curve,
        associatedUserAccountInfo: buyState.associatedUserAccountInfo,
        mint: baseMint,
        user,
        amount: minOutAmount,
        solAmount: swapAmount,
        slippage: 0,
        tokenProgram,
      })
    : PUMP_SDK.sellInstructions({
        global,
        bondingCurveAccountInfo: buyState.bondingCurveAccountInfo,
        bondingCurve: curve,
        mint: baseMint,
        user,
        amount: swapAmount,
        solAmount: minOutAmount.add(outputFee),
        slippage: 0,
        tokenProgram,
        mayhemMode: curve.isMayhemMode,
        cashback: curve.isCashbackCoin,
      });
}

async function quotedInstructions(
  payingSol: boolean,
  cashback: boolean,
  global: Parameters<typeof getBuyTokenAmountFromSolAmount>[0]["global"],
  buyState: Awaited<ReturnType<OnlinePumpSdk["fetchBuyState"]>>,
  curve: BondingCurve,
  baseMint: PublicKey,
  user: PublicKey,
  minOutAmount: BN,
  swapAmount: BN,
  outputFee: BN,
  tokenProgram: PublicKey,
) {
  if (!buyState.bondingCurveAccountInfo) throw new Error("This token does not have a PumpSwap pool yet.");
  const quoteTokenProgram = buyState.quoteTokenProgram;
  if (cashback) {
    return payingSol
      ? PUMP_SDK.buyV2Instructions({
          global,
          bondingCurveAccountInfo: buyState.bondingCurveAccountInfo,
          bondingCurve: curve,
          associatedUserAccountInfo: buyState.associatedUserAccountInfo,
          mint: baseMint,
          user,
          amount: minOutAmount,
          quoteAmount: swapAmount,
          slippage: 0,
          tokenProgram,
          quoteTokenProgram,
        })
      : PUMP_SDK.sellV2Instructions({
          global,
          bondingCurveAccountInfo: buyState.bondingCurveAccountInfo,
          bondingCurve: curve,
          mint: baseMint,
          user,
          amount: swapAmount,
          quoteAmount: minOutAmount.add(outputFee),
          slippage: 0,
          tokenProgram,
          quoteTokenProgram,
        });
  }
  return payingSol
    ? PUMP_SDK.buyExactQuoteInV3Instructions({
        bondingCurve: curve,
        associatedUserAccountInfo: buyState.associatedUserAccountInfo,
        mint: baseMint,
        user,
        amount: minOutAmount,
        quoteAmount: swapAmount,
        slippage: 0,
        tokenProgram,
        quoteTokenProgram,
        partialFill: curve.isMayhemMode,
      })
    : PUMP_SDK.sellV3Instructions({
        bondingCurve: curve,
        mint: baseMint,
        user,
        amount: swapAmount,
        quoteAmount: minOutAmount.add(outputFee),
        slippage: 0,
        tokenProgram,
        quoteTokenProgram,
      });
}

function floorBps(amount: BN, bps: number): BN {
  return amount.muln(bps).divn(10_000);
}

function roundTripSol(
  global: Parameters<typeof getSellSolAmountFromTokenAmount>[0]["global"],
  feeConfig: Parameters<typeof getSellSolAmountFromTokenAmount>[0]["feeConfig"],
  curve: BondingCurve,
  solIn: BN,
  tokensOut: BN,
): string | undefined {
  const nextTokens = curve.virtualTokenReserves.sub(tokensOut);
  if (nextTokens.lten(0)) return undefined;
  const shifted: BondingCurve = {
    ...curve,
    virtualQuoteReserves: curve.virtualQuoteReserves.add(solIn),
    virtualTokenReserves: nextTokens,
  };
  try {
    return getSellSolAmountFromTokenAmount({
      global,
      feeConfig,
      mintSupply: curve.tokenTotalSupply,
      bondingCurve: shifted,
      amount: tokensOut,
    }).toString();
  } catch {
    return undefined;
  }
}

function priceImpact(payingSol: boolean, amountIn: BN, amountOut: BN, curve: BondingCurve): string {
  const reserveIn = payingSol ? curve.virtualQuoteReserves : curve.virtualTokenReserves;
  const reserveOut = payingSol ? curve.virtualTokenReserves : curve.virtualQuoteReserves;
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


