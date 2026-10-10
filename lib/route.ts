import { PublicKey, TransactionInstruction, type AccountMeta } from "@solana/web3.js";
import program from "../program-id/goblock-program.json";

export const GOBLOCK_PROGRAM_ID = new PublicKey(program.programId);

export function routeInstruction(user: PublicKey, instructions: TransactionInstruction[]): TransactionInstruction {
  if (instructions.length === 0 || instructions.length > 16) {
    throw new Error("A route needs between 1 and 16 instructions.");
  }

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

  const parts: Buffer[] = [Buffer.from([0, instructions.length])];
  for (const instruction of instructions) {
    if (instruction.keys.length > 22) throw new Error("Too many accounts to route.");
    const programIndex = indexOf({ pubkey: instruction.programId, isSigner: false, isWritable: false });
    const indexes = instruction.keys.map((key) => indexOf(key));
    const length = Buffer.alloc(2);
    length.writeUInt16LE(instruction.data.length);
    parts.push(Buffer.from([programIndex, indexes.length, ...indexes]), length, Buffer.from(instruction.data));
  }

  return new TransactionInstruction({
    programId: GOBLOCK_PROGRAM_ID,
    keys: accounts,
    data: Buffer.concat(parts),
  });
}
