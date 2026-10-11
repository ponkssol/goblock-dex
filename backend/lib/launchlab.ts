import { PublicKey, type TransactionInstruction } from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Curve,
  getPdaLaunchpadPoolId,
  LAUNCHPAD_PROGRAM,
  LaunchpadConfig,
  LaunchpadPool,
  PlatformConfig,
  Raydium,
  TxVersion,
} from "@raydium-io/raydium-sdk-v2";
import BN from "bn.js";
import type { SwapOrderInput, SwapQuote } from "./quote";
import { SOL_MINT } from "./tokens";
import {
  buildSwapTransaction,
  connection,
  instructionsFromVersioned,
  mintDecimals,
  networkFeeLamports,
  outputAfterFee,
  solFees,
  venueReceipt,
} from "./trade";

const READ_ONLY = new PublicKey("11111111111111111111111111111111");

type PoolInfo = ReturnType<typeof LaunchpadPool.decode>;
type ConfigInfo = ReturnType<typeof LaunchpadConfig.decode>;
type PlatformInfo = ReturnType<typeof PlatformConfig.decode>;

let loaded: Promise<Raydium> | null = null;

export async function quoteLaunchLab(input: SwapOrderInput): Promise<SwapQuote> {
  const amount = new BN(input.amount);
  const linkFee = input.assemble !== false && Boolean(input.brandWallet);
  const legs = solFees(input.inputMint, input.outputMint, amount, linkFee);
  const opened = await openPool(input.inputMint, input.outputMint);
  const slot = await connection.getSlot("confirmed");
  const payingSol = input.inputMint === opened.pool.mintB.toBase58();
  const quoted = curveOut(opened, payingSol, legs.swapIn, slot);
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
    pool: opened.poolId.toBase58(),
    programId: LAUNCHPAD_PROGRAM.toBase58(),
    venue: "Raydium",
    receipt: venueReceipt("Raydium"),
    feeBps: fee.isZero() ? 0 : 5,
    feeAmount: fee.toString(),
    networkFeeLamports: feeText,
    memo: input.brand,
    inputMintDecimals,
    outputMintDecimals,
    roundTripOutAmount:
      input.inputMint === SOL_MINT && input.roundTrip !== false
        ? sellBack(opened, outAmount, slot)
        : undefined,
  };

  if (!input.userPublicKey) return quote;
  const user = new PublicKey(input.userPublicKey);
  const sdk = await raydium();
  sdk.setOwner(user);
  const prepared =
    payingSol && opened.pool.mintB.toBase58() !== SOL_MINT
      ? await prepareQuoteAccount(sdk, user, opened.pool.mintB)
      : null;
  const built = await (payingSol
    ? sdk.launchpad.buyToken({
        programId: LAUNCHPAD_PROGRAM,
        mintA: opened.pool.mintA,
        mintB: opened.pool.mintB,
        poolInfo: opened.pool,
        configInfo: opened.config,
        platformFeeRate: opened.platform.feeRate,
        buyAmount: legs.swapIn,
        slippage: new BN(input.slippageBps),
        txVersion: TxVersion.V0,
      })
    : sdk.launchpad.sellToken({
        programId: LAUNCHPAD_PROGRAM,
        mintA: opened.pool.mintA,
        mintB: opened.pool.mintB,
        poolInfo: opened.pool,
        configInfo: opened.config,
        platformFeeRate: opened.platform.feeRate,
        sellAmount: legs.swapIn,
        slippage: new BN(input.slippageBps),
        txVersion: TxVersion.V0,
      })
  ).finally(() => prepared?.restore());
  const unpacked = await instructionsFromVersioned(built.transaction);
  unpacked.instructions = [...(prepared?.instructions ?? []), ...unpacked.instructions];
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

function sellBack(opened: OpenedPool, tokensOut: BN, slot: number): string | undefined {
  try {
    return curveOut(opened, false, tokensOut, slot).gross.toString();
  } catch {
    return undefined;
  }
}

function curveOut(opened: OpenedPool, payingQuote: boolean, amountIn: BN, slot: number): { gross: BN; min: BN } {
  const rates = {
    poolInfo: opened.pool,
    protocolFeeRate: opened.config.tradeFeeRate,
    platformFeeRate: opened.platform.feeRate,
    curveType: opened.config.curveType,
    shareFeeRate: new BN(0),
    creatorFeeRate: opened.platform.creatorFeeRate,
    transferFeeConfigA: undefined,
    slot,
  };
  const quoted = payingQuote
    ? Curve.buyExactIn({ ...rates, amountB: amountIn })
    : Curve.sellExactIn({ ...rates, amountA: amountIn });
  const gross = payingQuote ? netAmount(quoted.amountA) : quoted.amountB;
  if (gross.lten(0)) throw new Error("Amount is too small for this pool.");
  return { gross, min: gross };
}

function netAmount(amount: { amount: BN; fee?: BN | null }): BN {
  return amount.fee ? amount.amount.sub(amount.fee) : amount.amount;
}

type OpenedPool = { poolId: PublicKey; pool: PoolInfo; config: ConfigInfo; platform: PlatformInfo };

async function openPool(inputMint: string, outputMint: string): Promise<OpenedPool> {
  for (const [mintA, mintB] of orientations(inputMint, outputMint)) {
    const poolId = getPdaLaunchpadPoolId(LAUNCHPAD_PROGRAM, new PublicKey(mintA), new PublicKey(mintB)).publicKey;
    const info = await connection.getAccountInfo(poolId, "confirmed");
    if (!info?.owner.equals(LAUNCHPAD_PROGRAM)) continue;
    const pool = decode(LaunchpadPool, info.data);
    if (!pool.mintA.equals(new PublicKey(mintA))) continue;
    if (pool.status === 1) throw new Error("This token is migrating. Try again in a moment.");
    if (pool.status !== 0) continue;
    const [configAccount, platformAccount] = await Promise.all([
      connection.getAccountInfo(pool.configId, "confirmed"),
      connection.getAccountInfo(pool.platformId, "confirmed"),
    ]);
    if (!configAccount || !platformAccount) continue;
    return {
      poolId,
      pool,
      config: decode(LaunchpadConfig, configAccount.data),
      platform: decode(PlatformConfig, platformAccount.data),
    };
  }
  throw new Error("No Raydium pool was found for this pair.");
}

function orientations(inputMint: string, outputMint: string): Array<[string, string]> {
  if (inputMint === SOL_MINT) return [[outputMint, inputMint]];
  if (outputMint === SOL_MINT) return [[inputMint, outputMint]];
  return [
    [inputMint, outputMint],
    [outputMint, inputMint],
  ];
}

function decode<T>(layout: { decode: (data: Buffer) => T }, data: Buffer): T {
  try {
    return layout.decode(data);
  } catch {
    return layout.decode(data.subarray(8));
  }
}

async function prepareQuoteAccount(sdk: Raydium, owner: PublicKey, mint: PublicKey): Promise<{
  instructions: TransactionInstruction[];
  restore: () => void;
}> {
  const mintInfo = await connection.getAccountInfo(mint);
  const program = mintInfo?.owner ?? TOKEN_PROGRAM_ID;
  const ata = getAssociatedTokenAddressSync(mint, owner, false, program);
  await sdk.account.fetchWalletTokenAccounts();
  const previous = sdk.account.tokenAccountRawInfos;
  const known = previous.some((item) => item.accountInfo.mint.equals(mint));
  if (!known) {
    const sample = previous[0]?.accountInfo;
    sdk.account.updateTokenAccount({
      tokenAccountRawInfos: [
        ...previous,
        {
          pubkey: ata,
          programId: program,
          accountInfo: { ...sample, mint, owner, amount: new BN(0) },
        },
      ],
    });
  }
  const exists = await connection.getAccountInfo(ata);
  return {
    instructions: exists ? [] : [createAssociatedTokenAccountIdempotentInstruction(owner, ata, owner, mint, program)],
    restore: () => {
      if (!known) sdk.account.updateTokenAccount({ tokenAccountRawInfos: previous });
      (sdk.account as unknown as { _clientOwnedToken: boolean })._clientOwnedToken = false;
    },
  };
}

function raydium(): Promise<Raydium> {
  loaded ??= Raydium.load({
    connection,
    owner: READ_ONLY,
    disableLoadToken: true,
    disableFeatureCheck: true,
  });
  return loaded;
}
