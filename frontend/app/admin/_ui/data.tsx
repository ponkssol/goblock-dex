"use client";

import { useEffect, useState } from "react";
import { adminApi, useSession } from "../../dashboard/_ui/session";

export type WaitRow = { id: string; email: string; wallet: string | null; createdAt: string };

export type PayRow = {
  signature: string;
  wallet: string;
  plan: string;
  asset: string;
  amount: string;
  keyId: string;
  createdAt: string | null;
};

export type KeyRow = {
  id: string;
  wallet: string;
  label: string;
  plan: string;
  masked: string;
  createdAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
  expiresAt: string | null;
  requestsToday: number;
  requests30d: number;
};

export type Overview = {
  keys: number;
  activeKeys: number;
  payments: number;
  waiting: number;
  codes: number;
  requestsToday: number;
  recentPayments: PayRow[];
  recentWaitlist: WaitRow[];
};

export function useAdmin<T>(path: string) {
  const session = useSession();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!session) return;
    let gone = false;
    setError("");
    adminApi<T>(path, session.token)
      .then((body) => {
        if (!gone) setData(body);
      })
      .catch((caught: unknown) => {
        if (!gone) setError(caught instanceof Error ? caught.message : "Something went wrong. Try again.");
      });
    return () => {
      gone = true;
    };
  }, [session, path, tick]);

  return { data, error, reload: () => setTick((value) => value + 1), token: session?.token ?? "" };
}

export function money(asset: string, amount: string) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return `${amount} ${asset}`;
  if (asset === "SOL") return `${(value / 1e9).toLocaleString("en-US", { maximumFractionDigits: 4 })} SOL`;
  if (asset === "USDC") return `${(value / 1e6).toLocaleString("en-US", { maximumFractionDigits: 2 })} USDC`;
  return `${amount} ${asset}`;
}

export function Loading({ error }: { error: string }) {
  if (error) return <p className="b-error">{error}</p>;
  return (
    <div className="ds-loading">
      <i />
      <i />
      <i />
    </div>
  );
}
