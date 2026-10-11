"use client";

import { useEffect } from "react";
import { useGoblockWallet } from "./wallet";
import { publishWallet } from "./wallet-lite";

export function WalletBridge() {
  const { connected, publicKey, openWallet, disconnect } = useGoblockWallet();
  const address = publicKey?.toBase58() ?? null;

  useEffect(() => {
    publishWallet({ ready: true, connected, address }, { open: openWallet, disconnect });
  });

  return null;
}
