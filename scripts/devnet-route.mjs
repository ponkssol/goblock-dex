import { readFileSync } from "node:fs";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";

const programId = new PublicKey("4gZQouUvsDc4zEd3msfnw9or4uxtSBxZejoy6XcsGTPb");
const wallet = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync("Wallet.json", "utf8"))));
const connection = new Connection(process.argv[2] ?? "https://api.devnet.solana.com", "confirmed");
const recipient = Keypair.generate();
const transfer = SystemProgram.transfer({
  fromPubkey: wallet.publicKey,
  toPubkey: recipient.publicKey,
  lamports: 1_000_000,
});

const accounts = [
  { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
  { pubkey: transfer.programId, isSigner: false, isWritable: false },
  { pubkey: recipient.publicKey, isSigner: false, isWritable: true },
];
const length = Buffer.alloc(2);
length.writeUInt16LE(transfer.data.length);
const data = Buffer.concat([
  Buffer.from([0, 1, 1, transfer.keys.length, 0, 2]),
  length,
  Buffer.from(transfer.data),
]);

const transaction = new Transaction().add({ programId, keys: accounts, data });
const signature = await sendAndConfirmTransaction(connection, transaction, [wallet], { commitment: "confirmed" });
const program = await connection.getAccountInfo(programId, "confirmed");
const received = await connection.getBalance(recipient.publicKey, "confirmed");
console.log(JSON.stringify({
  signature,
  programExecutable: program?.executable ?? false,
  programOwner: program?.owner.toBase58() ?? null,
  programBytes: program?.data.length ?? 0,
  recipient: recipient.publicKey.toBase58(),
  received,
}));
