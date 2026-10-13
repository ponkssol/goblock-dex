import { getAssociatedTokenAddressSync, NATIVE_MINT } from "@solana/spl-token";
import {
  ComputeBudgetProgram,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  type AccountMeta,
} from "@solana/web3.js";
import BN from "bn.js";
import { quotePumpSwap } from "./pumpswap";
import { GOBLOCK_PROGRAM_ID } from "./route";
import { connection, priorityFeeMicroLamports } from "./trade";

export const VAULT = PublicKey.findProgramAddressSync([Buffer.from("vault")], GOBLOCK_PROGRAM_ID)[0];
export const BUYBACK_CONFIG = PublicKey.findProgramAddressSync([Buffer.from("config")], GOBLOCK_PROGRAM_ID)[0];
export const TEAM_WALLET = new PublicKey("CwVD4jd6BeLAWZeEqMFerD8bLoQevSy5rmwawFTa3nuo");
export const BUYBACK_THRESHOLD = 100_000_000;
export const TEAM_PERCENT = 60;
export const VAULT_RESERVE = 1_000_000;

const DISTRIBUTE = 2;
const SET_MINT = 3;
const MAX_STEPS = 16;
const MAX_ACCOUNTS = 32;
const CU_LIMIT = 400_000;
const BUY_SLIPPAGE_BPS = 300;
/** Left in the reserve so the vault can pay rent for the accounts a buy opens. */
const BUY_MARGIN = 10_000_000;
const MIN_BUY = 5_000_000;

export type BuybackState = {
  vault: string;
  config: string;
  team: string;
  programId: string;
  mint: string | null;
  mintDecimals: number | null;
  vaultLamports: number;
  reservedLamports: number;
  pendingLamports: number;
  thresholdLamports: number;
  teamPercent: number;
  splitReady: boolean;
  buyReady: boolean;
  totals: { teamLamports: string; buybackLamports: string; burned: string; rounds: string };
};

export async function buybackState(): Promise<BuybackState> {
  const [vault, config] = await connection.getMultipleAccountsInfo([VAULT, BUYBACK_CONFIG], "confirmed");
  const data = config && config.owner.equals(GOBLOCK_PROGRAM_ID) && config.data.length >= 80 ? config.data : null;
  const mintBytes = data?.subarray(8, 40);
  const mint = mintBytes && mintBytes.some((byte) => byte !== 0) ? new PublicKey(mintBytes).toBase58() : null;
  const reserved = data ? Number(data.readBigUInt64LE(40)) : 0;
  const vaultLamports = vault?.lamports ?? 0;
  const pending = Math.max(0, vaultLamports - VAULT_RESERVE - reserved);
  const splitReady = pending >= BUYBACK_THRESHOLD;
  const budget = reserved + (splitReady ? pending - teamShare(pending) : 0);
  const mintInfo = mint ? await connection.getAccountInfo(new PublicKey(mint), "confirmed") : null;
  return {
    vault: VAULT.toBase58(),
    config: BUYBACK_CONFIG.toBase58(),
    team: TEAM_WALLET.toBase58(),
    programId: GOBLOCK_PROGRAM_ID.toBase58(),
    mint,
    mintDecimals: mintInfo && mintInfo.data.length >= 82 ? mintInfo.data[44] : null,
    vaultLamports,
    reservedLamports: reserved,
    pendingLamports: pending,
    thresholdLamports: BUYBACK_THRESHOLD,
    teamPercent: TEAM_PERCENT,
    splitReady,
    buyReady: mint !== null && budget - BUY_MARGIN >= MIN_BUY,
    totals: {
      teamLamports: data ? data.readBigUInt64LE(48).toString() : "0",
      buybackLamports: data ? data.readBigUInt64LE(56).toString() : "0",
      burned: data ? data.readBigUInt64LE(64).toString() : "0",
      rounds: data ? data.readBigUInt64LE(72).toString() : "0",
    },
  };
}

function teamShare(lamports: number): number {
  return Math.floor(lamports / 100) * TEAM_PERCENT + Math.floor(((lamports % 100) * TEAM_PERCENT) / 100);
}

/** Instructions that buy the configured mint with the vault as the buyer, and the least it must burn. */
export async function buybackSteps(
  state: BuybackState,
): Promise<{ instructions: TransactionInstruction[]; minBurn: BN; tokenProgram: PublicKey; holding: PublicKey } | null> {
  if (!state.mint || !state.buyReady) return null;
  const mint = new PublicKey(state.mint);
  const mintInfo = await connection.getAccountInfo(mint);
  if (!mintInfo) throw new Error("The buyback mint was not found.");
  const tokenProgram = mintInfo.owner;
  const budget =
    state.reservedLamports + (state.splitReady ? state.pendingLamports - teamShare(state.pendingLamports) : 0);
  const quote = (await quotePumpSwap({
    inputMint: NATIVE_MINT.toBase58(),
    outputMint: state.mint,
    amount: String(budget - BUY_MARGIN),
    slippageBps: BUY_SLIPPAGE_BPS,
    userPublicKey: VAULT.toBase58(),
    assemble: false,
  })) as unknown as { minOutAmount: string; instructions?: TransactionInstruction[] };
  const instructions = (quote.instructions ?? []).filter(
    (instruction) => !instruction.programId.equals(ComputeBudgetProgram.programId),
  );
  if (instructions.length === 0) throw new Error("The buyback route was not created.");
  return {
    instructions,
    minBurn: new BN(quote.minOutAmount),
    tokenProgram,
    holding: getAssociatedTokenAddressSync(mint, VAULT, true, tokenProgram),
  };
}

export function distributeInstruction(
  payer: PublicKey,
  buy: { instructions: TransactionInstruction[]; minBurn: BN; tokenProgram: PublicKey; holding: PublicKey; mint: PublicKey } | null,
): TransactionInstruction {
  if (buy && buy.instructions.length > MAX_STEPS) throw new Error("The buyback needs too many instructions.");
  const placeholder = SystemProgram.programId;
  const accounts: AccountMeta[] = [
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: VAULT, isSigner: false, isWritable: true },
    { pubkey: BUYBACK_CONFIG, isSigner: false, isWritable: true },
    { pubkey: TEAM_WALLET, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: buy?.holding ?? placeholder, isSigner: false, isWritable: Boolean(buy) },
    { pubkey: buy?.mint ?? placeholder, isSigner: false, isWritable: Boolean(buy) },
    { pubkey: buy?.tokenProgram ?? placeholder, isSigner: false, isWritable: false },
  ];
  const indexOf = (meta: AccountMeta) => {
    const signs = meta.isSigner && !meta.pubkey.equals(VAULT);
    const existing = accounts.findIndex((item, index) => index > 7 && item.pubkey.equals(meta.pubkey));
    const fixed = accounts.findIndex((item, index) => index <= 7 && item.pubkey.equals(meta.pubkey));
    if (fixed >= 0 && (!meta.isWritable || accounts[fixed].isWritable) && (!signs || accounts[fixed].isSigner)) {
      return fixed;
    }
    if (existing >= 0) {
      accounts[existing].isSigner ||= signs;
      accounts[existing].isWritable ||= meta.isWritable;
      return existing;
    }
    if (accounts.length > 255) throw new Error("Too many accounts in the buyback.");
    accounts.push({ pubkey: meta.pubkey, isSigner: signs, isWritable: meta.isWritable });
    return accounts.length - 1;
  };
  const parts: Buffer[] = [];
  for (const instruction of buy?.instructions ?? []) {
    if (instruction.keys.length > MAX_ACCOUNTS) throw new Error("Too many accounts in the buyback.");
    const programIndex = indexOf({ pubkey: instruction.programId, isSigner: false, isWritable: false });
    const indexes = instruction.keys.map((key) => indexOf(key));
    const length = Buffer.alloc(2);
    length.writeUInt16LE(instruction.data.length);
    parts.push(Buffer.from([programIndex, indexes.length, ...indexes]), length, Buffer.from(instruction.data));
  }
  const minBurn = Buffer.alloc(8);
  minBurn.writeBigUInt64LE(BigInt((buy?.minBurn ?? new BN(0)).toString()));
  return new TransactionInstruction({
    programId: GOBLOCK_PROGRAM_ID,
    keys: accounts,
    data: Buffer.concat([Buffer.from([DISTRIBUTE]), minBurn, Buffer.from([buy?.instructions.length ?? 0]), ...parts]),
  });
}

export function setMintInstruction(mint: PublicKey): TransactionInstruction {
  return new TransactionInstruction({
    programId: GOBLOCK_PROGRAM_ID,
    keys: [
      { pubkey: TEAM_WALLET, isSigner: true, isWritable: true },
      { pubkey: BUYBACK_CONFIG, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([SET_MINT]),
  });
}

/** An unsigned distribute transaction that `payer` signs and sends. */
export async function distributeTransaction(
  payer: PublicKey,
): Promise<{ transaction: string; lastValidBlockHeight: number; buyback: boolean }> {
  const state = await buybackState();
  if (!state.splitReady && !state.buyReady) throw new Error("Nothing to distribute yet.");
  const steps = await buybackSteps(state).catch(() => null);
  if (steps && state.mint) {
    const built = await compile(payer, [distributeInstruction(payer, { ...steps, mint: new PublicKey(state.mint) })]).catch(
      () => null,
    );
    if (built && (await simulates(built.transaction))) return { ...built, buyback: true };
  }
  if (!state.splitReady) throw new Error("The buyback cannot run right now. Try again in a minute.");
  return { ...(await compile(payer, [distributeInstruction(payer, null)])), buyback: false };
}

async function simulates(transaction: string): Promise<boolean> {
  const result = await connection.simulateTransaction(VersionedTransaction.deserialize(Buffer.from(transaction, "base64")), {
    sigVerify: false,
    replaceRecentBlockhash: true,
    commitment: "confirmed",
  });
  return result.value.err === null;
}

export async function setMintTransaction(mint: PublicKey): Promise<{ transaction: string; lastValidBlockHeight: number }> {
  const info = await connection.getAccountInfo(mint);
  if (!info || info.data.length < 82 || info.data[45] !== 1) throw new Error("That address is not a token mint.");
  const state = await buybackState();
  if (state.mint) throw new Error("The buyback token is already set and locked.");
  return compile(TEAM_WALLET, [setMintInstruction(mint)]);
}

async function compile(payer: PublicKey, instructions: TransactionInstruction[]) {
  const microLamports = await priorityFeeMicroLamports();
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const message = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: blockhash,
    instructions: [
      ComputeBudgetProgram.setComputeUnitLimit({ units: CU_LIMIT }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports }),
      ...instructions,
    ],
  }).compileToV0Message();
  const serialized = new VersionedTransaction(message).serialize();
  if (serialized.length > 1232) throw new Error("The buyback does not fit in one transaction.");
  return { transaction: Buffer.from(serialized).toString("base64"), lastValidBlockHeight };
}
