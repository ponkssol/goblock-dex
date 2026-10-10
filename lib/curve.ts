import {
  NATIVE_MINT,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  ComputeBudgetProgram,
  Connection,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  bondingCurvePda,
  computeFeesBps,
  getBuyTokenAmountFromSolAmount,
  getSellSolAmountFromTokenAmount,
  OnlinePumpSdk,
  PUMP_PROGRAM_ID,
  PUMP_SDK,
  type BondingCurve,
} from "@pump-fun/pump-sdk";
import BN from "bn.js";
import { brandFee, feeTransfers } from "./fees";
import type { SwapQuote } from "./quote";

const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
const CU_LIMIT = 300_000;
const PRIORITY_FEE_CAP_LAMPORTS = 100_000;

let priorityCache: { at: number; microLamports: number } | null = null;

export async function quoteBondingCurve(
  connection: Connection,
  input: {
    amount: string;
    slippageBps: number;
    userPublicKey?: string;
    brand?: string;
    brandWallet?: string;
  },
  baseMint: PublicKey,
  payingSol: boolean,
  user: PublicKey,
): Promise<SwapQuote> {
  const mintAccount = await connection.getAccountInfo(baseMint);
  const tokenProgram = mintAccount?.owner;
  if (
    !mintAccount ||
    !tokenProgram ||
    (!tokenProgram.equals(TOKEN_PROGRAM_ID) && !tokenProgram.equals(TOKEN_2022_PROGRAM_ID))
  ) {
    throw new Error("This token does not have a PumpSwap pool yet.");
  }

  const curveAccount = await connection.getAccountInfo(bondingCurvePda(baseMint));
  if (!curveAccount?.owner.equals(PUMP_PROGRAM_ID) || curveAccount.data.length < 49) {
    throw new Error("This token does not have a PumpSwap pool yet.");
  }

  const online = new OnlinePumpSdk(connection);
  const [global, feeConfig, buyState] = await Promise.all([
    online.fetchGlobal(),
    online.fetchFeeConfig().catch(() => null),
    online.fetchBuyState(baseMint, user, tokenProgram),
  ]);
  const curve = buyState.bondingCurve;
  if (curve.virtualTokenReserves.isZero() && curve.realTokenReserves.isZero()) {
    throw new Error("This token is migrating to PumpSwap. Try again in a moment.");
  }
  if (!isSolQuote(curve.quoteMint)) {
    throw new Error("This token is not quoted in SOL.");
  }
  if (payingSol && (curve.complete || curve.realTokenReserves.isZero())) {
    throw new Error("This token has filled its bonding curve and is waiting to migrate.");
  }

  const amount = new BN(input.amount);
  const slippageBps = input.slippageBps;
  const linkFee = Boolean(input.brandWallet);
  const inputFee = payingSol ? brandFee(amount, linkFee) : new BN(0);
  if (payingSol && inputFee.gte(amount)) throw new Error("Amount is too small for the brand fee.");
  const swapAmount = payingSol ? amount.sub(inputFee) : amount;
  const quoteMint = curve.quoteMint.equals(PublicKey.default) ? NATIVE_MINT : curve.quoteMint;
  const decimals = mintAccount.data[44] ?? 6;

  const tokens = payingSol
    ? getBuyTokenAmountFromSolAmount({
        global,
        feeConfig,
        mintSupply: curve.tokenTotalSupply,
        bondingCurve: curve,
        amount: swapAmount,
        quoteMint,
      })
    : swapAmount;
  const solOut = payingSol
    ? new BN(0)
    : getSellSolAmountFromTokenAmount({
        global,
        feeConfig,
        mintSupply: curve.tokenTotalSupply,
        bondingCurve: curve,
        amount: swapAmount,
      });
  if ((payingSol && tokens.isZero()) || (!payingSol && solOut.isZero())) {
    throw new Error("Amount is too small for this pool.");
  }

  const outputFee = payingSol ? new BN(0) : brandFee(solOut, linkFee);
  const grossOut = payingSol ? tokens : solOut;
  const outAmount = grossOut.sub(outputFee);
  if (outAmount.lten(0) || (!payingSol && outputFee.gte(solOut))) {
    throw new Error("Amount is too small for the brand fee.");
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
  const microLamports = await priorityFeeMicroLamports(connection);

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
    roundTripOutAmount: payingSol ? roundTripSol(global, feeConfig, curve, swapAmount, tokens) : undefined,
    feeBps: fee.isZero() ? 0 : 5,
    feeAmount: fee.toString(),
    memo: input.brand,
    inputMintDecimals: payingSol ? 9 : decimals,
    outputMintDecimals: payingSol ? decimals : 9,
    networkFeeLamports: String(5_000 + Math.floor((microLamports * CU_LIMIT) / 1_000_000)),
  };

  if (!input.userPublicKey) return quote;

  if (!buyState.bondingCurveAccountInfo) {
    throw new Error("This token does not have a PumpSwap pool yet.");
  }
  if (!payingSol && !buyState.associatedUserAccountInfo) {
    throw new Error("This wallet does not hold that token.");
  }

  const instructions = payingSol
    ? await PUMP_SDK.buyInstructions({
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
    : await PUMP_SDK.sellInstructions({
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

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const message = new TransactionMessage({
    payerKey: user,
    recentBlockhash: blockhash,
    instructions: [
      ComputeBudgetProgram.setComputeUnitLimit({ units: CU_LIMIT }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports }),
      ...instructions,
      ...(input.brandWallet ? feeTransfers(user, new PublicKey(input.brandWallet), fee) : []),
      ...(input.brand ? [brandMemo(input.brand, user)] : []),
    ],
  }).compileToV0Message();

  return {
    ...quote,
    transaction: Buffer.from(new VersionedTransaction(message).serialize()).toString("base64"),
    lastValidBlockHeight,
  };
}

function isSolQuote(mint: PublicKey): boolean {
  return mint.equals(PublicKey.default) || mint.equals(NATIVE_MINT);
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

async function priorityFeeMicroLamports(connection: Connection): Promise<number> {
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

function brandMemo(brand: string, signer: PublicKey): TransactionInstruction {
  return new TransactionInstruction({
    programId: MEMO_PROGRAM_ID,
    keys: [{ pubkey: signer, isSigner: true, isWritable: false }],
    data: Buffer.from(brand, "utf8"),
  });
}
