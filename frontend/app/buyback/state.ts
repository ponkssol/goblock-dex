"use client";

import { useCallback, useEffect, useState } from "react";

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

export function useBuybackState(refreshMs = 15_000) {
  const [state, setState] = useState<BuybackState | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/buyback", { cache: "no-store" });
      const body = (await response.json()) as BuybackState & { msg?: string };
      if (!response.ok) throw new Error(body.msg ?? "The vault could not be read.");
      setState(body);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The vault could not be read.");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), refreshMs);
    return () => clearInterval(timer);
  }, [refresh, refreshMs]);

  return { state, error, refresh };
}

export function sol(lamports: number | string, digits = 4) {
  return (Number(lamports) / 1e9).toLocaleString("en-US", {
    minimumFractionDigits: Math.min(2, digits),
    maximumFractionDigits: digits,
  });
}

export function solscan(path: string) {
  return `https://solscan.io/${path}`;
}
