import { PublicKey, SystemProgram, TransactionInstruction, type AccountMeta } from "@solana/web3.js";
import BN from "bn.js";
import program from "../../program-id/goblock-program.json";

export const GOBLOCK_PROGRAM_ID = new PublicKey(program.programId);

const ALLOWED = new Set([
  "11111111111111111111111111111111",
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
  "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA",
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
  "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK",
  "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C",
  "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo",
  "Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB",
  "cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG",
  "dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN",
  "LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj",
  "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc",
]);

const TOKEN_PROGRAMS = new Set([
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
]);

const CHECKED = 1;
const MAX_ACCOUNTS = 32;

export function routeInstruction(
  user: PublicKey,
  instructions: TransactionInstruction[],
  floor: { account: PublicKey; mint: PublicKey; amount: BN; after?: TransactionInstruction[] },
  fee?: { lamports: BN; brand: PublicKey; treasury: PublicKey; treasuryLamports: BN },
): TransactionInstruction {
  const closing: TransactionInstruction[] = [];
  const opening: TransactionInstruction[] = [];
  for (const instruction of instructions) {
    if (!ALLOWED.has(instruction.programId.toBase58())) {
      throw new Error("goblock cannot forward this program.");
    }
    if (floor && isOutputClose(instruction, floor.account)) {
      if (closing.length === 0) closing.push(instruction);
      continue;
    }
    opening.push(instruction);
  }
  const after = [...closing, ...(floor?.after ?? [])];
  for (const instruction of after) {
    if (!ALLOWED.has(instruction.programId.toBase58())) {
      throw new Error("goblock cannot forward this program.");
    }
  }
  const total = opening.length + after.length;
  if (total === 0 || total > 16) throw new Error("A route needs between 1 and 16 instructions.");

  const accounts: AccountMeta[] = [{ pubkey: user, isSigner: true, isWritable: true }];
  const indexOf = (meta: AccountMeta) => {
    const existing = accounts.findIndex((item) => item.pubkey.equals(meta.pubkey));
    if (existing >= 0) {
      accounts[existing].isSigner ||= meta.isSigner;
      accounts[existing].isWritable ||= meta.isWritable;
      return existing;
    }
    if (accounts.length > 255) throw new Error("Too many accounts to route.");
    accounts.push({ pubkey: meta.pubkey, isSigner: meta.isSigner, isWritable: meta.isWritable });
    return accounts.length - 1;
  };

  const encode = (list: TransactionInstruction[]) => {
    const parts: Buffer[] = [];
    for (const instruction of list) {
      if (instruction.keys.length > MAX_ACCOUNTS) throw new Error("Too many accounts to route.");
      const programIndex = indexOf({ pubkey: instruction.programId, isSigner: false, isWritable: false });
      const indexes = instruction.keys.map((key) => indexOf(key));
      const length = Buffer.alloc(2);
      length.writeUInt16LE(instruction.data.length);
      parts.push(Buffer.from([programIndex, indexes.length, ...indexes]), length, Buffer.from(instruction.data));
    }
    return parts;
  };

  if (floor.amount.isNeg() || floor.amount.bitLength() > 64) {
    throw new Error("The minimum output does not fit this route.");
  }
  const outputIndex = indexOf({ pubkey: floor.account, isSigner: false, isWritable: true });
  const minimum = Buffer.alloc(8);
  minimum.writeBigUInt64LE(BigInt(floor.amount.toString()));
  const feeLamports = Buffer.alloc(8);
  const treasuryLamports = Buffer.alloc(8);
  let systemIndex = 0;
  let treasuryIndex = 0;
  let brandIndex = 0;
  if (fee && fee.lamports.gtn(0)) {
    if (fee.lamports.bitLength() > 64 || fee.treasuryLamports.bitLength() > 64) {
      throw new Error("The brand fee does not fit this route.");
    }
    feeLamports.writeBigUInt64LE(BigInt(fee.lamports.toString()));
    treasuryLamports.writeBigUInt64LE(BigInt(fee.treasuryLamports.toString()));
    systemIndex = indexOf({ pubkey: SystemProgram.programId, isSigner: false, isWritable: false });
    treasuryIndex = indexOf({ pubkey: fee.treasury, isSigner: false, isWritable: true });
    brandIndex = indexOf({ pubkey: fee.brand, isSigner: false, isWritable: true });
  }
  return new TransactionInstruction({
    programId: GOBLOCK_PROGRAM_ID,
    keys: accounts,
    data: Buffer.concat([
      Buffer.from([CHECKED, outputIndex]),
      minimum,
      floor.mint.toBuffer(),
      feeLamports,
      treasuryLamports,
      Buffer.from([systemIndex, treasuryIndex, brandIndex, opening.length, after.length]),
      ...encode(opening),
      ...encode(after),
    ]),
  });
}

function isOutputClose(instruction: TransactionInstruction, output: PublicKey): boolean {
  return (
    TOKEN_PROGRAMS.has(instruction.programId.toBase58()) &&
    instruction.data[0] === 9 &&
    instruction.keys[0]?.pubkey.equals(output) === true
  );
}
