import { Connection, type ConnectionConfig } from "@solana/web3.js";

// The wallet only reads this address to recognize mainnet. Requests go to our /rpc proxy.
export const MAINNET_RPC = "https://api.mainnet-beta.solana.com";

export const connectionConfig: ConnectionConfig = {
  commitment: "confirmed",
  fetch: (_input, init) => fetch("/rpc", init),
};

export const connection = new Connection(MAINNET_RPC, connectionConfig);

export async function watchSignature(signature: string, lastValidBlockHeight: number) {
  const started = Date.now();
  while (Date.now() - started < 60_000) {
    const { value } = await connection.getSignatureStatuses([signature]);
    const status = value[0];
    if (status?.err) return "failed" as const;
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") {
      return "confirmed" as const;
    }
    const height = await connection.getBlockHeight("confirmed");
    if (height > lastValidBlockHeight) return "expired" as const;
    await new Promise((resolve) => setTimeout(resolve, 1200));
  }
  return "expired" as const;
}
