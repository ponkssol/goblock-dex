"use client";

import { useAppKit, useAppKitAccount, useAppKitProvider, useDisconnect } from "@reown/appkit/react";
import type { Provider } from "@reown/appkit-adapter-solana/react";
import { PublicKey, type VersionedTransaction } from "@solana/web3.js";
import { useMemo } from "react";
import { startAppKit } from "./appkit";
import { connection } from "./solana";

export function useGoblockWallet() {
  startAppKit();
  const account = useAppKitAccount({ namespace: "solana" });
  const { walletProvider } = useAppKitProvider<Provider>("solana");
  const { open } = useAppKit();
  const { disconnect } = useDisconnect();
  const publicKey = useMemo(() => {
    if (!account.address) return null;
    try {
      return new PublicKey(account.address);
    } catch {
      return null;
    }
  }, [account.address]);

  return {
    connection,
    publicKey,
    connected: Boolean(account.isConnected && publicKey),
    disconnect,
    openWallet: () => {
      void open({ view: "Connect" });
    },
    sendTransaction: (transaction: VersionedTransaction) => {
      if (!walletProvider) throw new Error("Connect a wallet first.");
      return walletProvider.sendTransaction(transaction, connection);
    },
    signMessage: (message: Uint8Array) => {
      if (!walletProvider) throw new Error("Connect a wallet first.");
      return walletProvider.signMessage(message);
    },
  };
}
