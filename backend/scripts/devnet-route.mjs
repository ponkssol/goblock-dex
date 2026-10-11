import { Connection, PublicKey } from "@solana/web3.js";

const programId = new PublicKey("GBLK6CfBQXsTjYZqzpNs5gxYjp8r3NqnqZiohjuvxMww");
const connection = new Connection(process.argv[2] ?? "https://api.devnet.solana.com", "confirmed");
const program = await connection.getAccountInfo(programId, "confirmed");
console.log(JSON.stringify({
  programExecutable: program?.executable ?? false,
  programOwner: program?.owner.toBase58() ?? null,
  programBytes: program?.data.length ?? 0,
  note: "Checked routes are built by the swap API. This script no longer sends an unchecked transfer.",
}));
