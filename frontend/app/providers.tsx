"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { setKitProject } from "./kit-config";
import { onWalletLoad, rememberedWallet } from "./wallet-lite";

const WalletBridge = dynamic(() => import("./wallet-bridge").then((module) => module.WalletBridge), { ssr: false });

export function Providers({ projectId, children }: { projectId: string; children: React.ReactNode }) {
  setKitProject(projectId);
  const [wallet, setWallet] = useState(false);

  useEffect(() => {
    const stop = onWalletLoad(() => setWallet(true));
    if (!rememberedWallet()) return stop;
    const idle = window.requestIdleCallback?.(() => setWallet(true), { timeout: 2500 });
    const timer = idle === undefined ? window.setTimeout(() => setWallet(true), 1200) : undefined;
    return () => {
      stop();
      if (idle !== undefined) window.cancelIdleCallback(idle);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, []);

  return (
    <>
      {children}
      {wallet && projectId ? <WalletBridge /> : null}
    </>
  );
}
