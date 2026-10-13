"use client";

import { useSyncExternalStore } from "react";

export type Session = { wallet: string; token: string; expiresAt: number };

export type ApiKey = {
  id: string;
  label: string;
  plan: string;
  masked: string;
  createdAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
  requestsToday: number;
  requests30d: number;
  expiresAt: string | null;
};

export type Day = { day: string; requests: number; errors: number };

export type Overview = {
  wallet: string;
  keyLimit: number;
  keys: ApiKey[];
  usage: Day[];
  feeWallets: string[];
  plan: "free" | "paid";
  fees: { pair: string; bps: number }[];
  platformFee: { minBps: number; maxBps: number };
};

export type NewKey = { key: string; id: string; masked: string; label: string; plan: string };

export type Earning = { wallet: string; lamports: number; swaps: number; lastAt: number | null; scanned: number };

const STORE = "goblock.dashboard.session";
const listeners = new Set<() => void>();
let cached: Session | null | undefined;

function read(): Session | null {
  if (cached !== undefined) return cached;
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE) ?? "null") as Session | null;
    cached = parsed && parsed.expiresAt > Date.now() ? parsed : null;
  } catch {
    cached = null;
  }
  return cached;
}

export function saveSession(session: Session | null) {
  cached = session;
  if (session) localStorage.setItem(STORE, JSON.stringify(session));
  else localStorage.removeItem(STORE);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORE) return;
    cached = undefined;
    listener();
  };
  listeners.add(listener);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useSession(): Session | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

export function currentSession() {
  return read();
}

export async function adminApi<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  return callApi(`/api/admin/${path}`, token, init);
}

export async function dashboardApi<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  return callApi(`/api/dashboard/${path}`, token, init);
}

async function callApi<T>(url: string, token: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...init.headers },
  });
  const body = (await response.json().catch(() => ({}))) as T & { msg?: string };
  if (response.status === 401) saveSession(null);
  if (!response.ok) throw new Error(body.msg ?? "Something went wrong. Try again.");
  return body;
}
