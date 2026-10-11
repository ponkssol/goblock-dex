import { PublicKey, VersionedTransaction } from "@solana/web3.js";
import BN from "bn.js";
import type { SwapOrderInput, SwapQuote } from "./quote";
import { SOL_MINT } from "./tokens";
import {
  bestQuote,
  buildSwapTransaction,
  instructionsFromVersioned,
  mintDecimals,
  networkFeeLamports,
  outputAfterFee,
  priorityFeeMicroLamports,
  receivingAccount,
  solFees,
  venueReceipt,
} from "./trade";

type RaydiumRoute = { poolId: string; feeAmount?: string };
type RaydiumData = {
  inputAmount: string;
  outputAmount: string;
  otherAmountThreshold?: string;
  priceImpactPct?: number;
  routePlan: RaydiumRoute[];
};

const poolPrograms = new Map<string, string>();

export async function quoteRaydium(input: SwapOrderInput): Promise<SwapQuote> {
  const { quoteLaunchLab } = await import("./launchlab");
  return bestQuote("No Raydium pool was found for this pair.", [quoteRaydiumAmm(input), quoteLaunchLab(input)]);
}

async function quoteRaydiumAmm(input: SwapOrderInput): Promise<SwapQuote> {
  const amount = new BN(input.amount);
  const linkFee = input.assemble !== false && Boolean(input.brandWallet);
  const legs = solFees(input.inputMint, input.outputMint, amount, linkFee);
  const computed = await compute(input.inputMint, input.outputMint, legs.swapIn, input.slippageBps);
  const grossOut = new BN(computed.data.outputAmount);
  const { outAmount, outputFee } = outputAfterFee(grossOut, legs.outputIsSol, linkFee);
  const threshold = new BN(computed.data.otherAmountThreshold ?? computed.data.outputAmount);
  const minOutAmount = outputAfterFee(threshold, legs.outputIsSol, linkFee).outAmount;
  const fee = legs.inputFee.add(outputFee);
  const pool = computed.data.routePlan[0].poolId;
  if (input.roundTrip === false && !poolPrograms.has(pool)) void poolProgram(pool);
  const [inputMintDecimals, outputMintDecimals, feeText, programId] = await Promise.all([
    mintDecimals(input.inputMint),
    mintDecimals(input.outputMint),
    networkFeeLamports(),
    input.roundTrip === false ? Promise.resolve(poolPrograms.get(pool) ?? pool) : poolProgram(pool),
  ]);

  const quote: SwapQuote = {
    side: input.inputMint === SOL_MINT ? "buy" : "sell",
    inAmount: amount.toString(),
    outAmount: outAmount.toString(),
    minOutAmount: minOutAmount.toString(),
    maxInAmount: amount.toString(),
    priceImpactPct: raydiumImpact(computed.data.priceImpactPct),
    pool,
    programId,
    venue: "Raydium",
    receipt: venueReceipt("Raydium"),
    feeBps: fee.isZero() ? 0 : 5,
    feeAmount: fee.toString(),
    networkFeeLamports: feeText,
    memo: input.brand,
    inputMintDecimals,
    outputMintDecimals,
    roundTripOutAmount:
      input.inputMint === SOL_MINT && input.roundTrip !== false ? await roundTrip(input.outputMint, outAmount) : undefined,
  };

  if (!input.userPublicKey) return quote;
  const user = new PublicKey(input.userPublicKey);
  const microLamports = await priorityFeeMicroLamports();
  const [inputAccount, outputAccount] = await Promise.all([
    input.inputMint === SOL_MINT ? undefined : receivingAccount(user, input.inputMint).then((account) => account.toBase58()),
    input.outputMint === SOL_MINT ? undefined : receivingAccount(user, input.outputMint).then((account) => account.toBase58()),
  ]);
  const response = await fetch("https://transaction-v1.raydium.io/transaction/swap-base-in", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      computeUnitPriceMicroLamports: String(microLamports),
      swapResponse: computed,
      txVersion: "V0",
      wallet: user.toBase58(),
      wrapSol: input.inputMint === SOL_MINT,
      unwrapSol: input.outputMint === SOL_MINT,
      ...(inputAccount ? { inputAccount } : {}),
      ...(outputAccount ? { outputAccount } : {}),
    }),
  });
  const body = (await response.json()) as { success?: boolean; msg?: string; data?: { transaction?: string }[] };
  const serialized = body.data?.[0]?.transaction;
  if (!response.ok || body.success === false || !serialized) throw new Error("Raydium did not build the swap.");
  const unpacked = await instructionsFromVersioned(VersionedTransaction.deserialize(Buffer.from(serialized, "base64")));
  if (input.assemble === false) return Object.assign(quote, unpacked);
  const built = await buildSwapTransaction({
    user,
    instructions: unpacked.instructions,
    lookupTables: unpacked.lookupTables,
    brand: input.brand,
    brandWallet: input.brandWallet,
    fee,
    outputMint: input.outputMint,
    minOut: minOutAmount,
  });
  return { ...quote, ...built };
}

async function roundTrip(outputMint: string, tokensOut: BN): Promise<string | undefined> {
  try {
    const back = await compute(outputMint, SOL_MINT, tokensOut, 0);
    return back.data.outputAmount;
  } catch {
    return undefined;
  }
}

async function compute(
  inputMint: string,
  outputMint: string,
  amountIn: BN,
  slippageBps: number,
): Promise<{ id?: string; success?: boolean; version?: string; data: RaydiumData }> {
  if (amountIn.lten(0)) throw new Error("Amount is too small for this pool.");
  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount: amountIn.toString(),
    slippageBps: String(slippageBps),
    txVersion: "V0",
  });
  const response = await fetch(`https://transaction-v1.raydium.io/compute/swap-base-in?${params}`);
  const body = (await response.json()) as { id?: string; success?: boolean; version?: string; data?: RaydiumData };
  const plan = body.data?.routePlan ?? [];
  if (!response.ok || !body.success || !body.data?.outputAmount || plan.length !== 1) {
    throw new Error("No Raydium pool was found for this pair.");
  }
  return { id: body.id, success: body.success, version: body.version, data: body.data };
}

async function poolProgram(pool: string): Promise<string> {
  const cached = poolPrograms.get(pool);
  if (cached) return cached;
  try {
    const response = await fetch(`https://api-v3.raydium.io/pools/info/ids?ids=${pool}`);
    const body = (await response.json()) as { data?: { programId?: string }[] };
    const programId = body.data?.[0]?.programId;
    if (programId) {
      poolPrograms.set(pool, programId);
      return programId;
    }
  } catch {
    // The pool address still identifies the trade when the directory is down.
  }
  return pool;
}

function raydiumImpact(percent: number | undefined): string {
  if (percent === undefined || !Number.isFinite(percent) || percent <= 0) return "0";
  const scale = 1_000_000_000;
  const fraction = Math.round((percent / 100) * scale);
  const whole = Math.floor(fraction / scale);
  const rest = String(fraction % scale).padStart(9, "0").replace(/0+$/, "");
  return rest ? `${whole}.${rest}` : String(whole);
}
