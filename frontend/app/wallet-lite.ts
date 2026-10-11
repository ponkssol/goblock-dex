"use client";

import { useSyncExternalStore } from "react";

type WalletSnapshot = { ready: boolean; connected: boolean; address: string | null };
type WalletActions = { open: () => void; disconnect: () => unknown };

const REMEMBER_KEY = "goblock.wallet";
const IDLE: WalletSnapshot = { ready: false, connected: false, address: null };

let snapshot = IDLE;
let actions: WalletActions | null = null;
let pendingOpen = false;
let loader: (() => void) | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function publishWallet(next: WalletSnapshot, nextActions: WalletActions) {
  actions = nextActions;
  if (next.connected !== snapshot.connected || next.address !== snapshot.address || next.ready !== snapshot.ready) {
    snapshot = next;
    listeners.forEach((listener) => listener());
  }
  if (next.connected) rememberWallet(true);
  if (pendingOpen) {
    pendingOpen = false;
    nextActions.open();
  }
}

export function onWalletLoad(load: () => void) {
  loader = load;
  return () => {
    if (loader === load) loader = null;
  };
}

export function loadWallet() {
  loader?.();
}

export function rememberedWallet() {
  try {
    return window.localStorage.getItem(REMEMBER_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberWallet(on: boolean) {
  try {
    if (on) window.localStorage.setItem(REMEMBER_KEY, "1");
    else window.localStorage.removeItem(REMEMBER_KEY);
  } catch {}
}

export function useWalletLite() {
  const state = useSyncExternalStore(subscribe, () => snapshot, () => IDLE);
  return {
    ...state,
    preload: loadWallet,
    openWallet: () => {
      if (actions) {
        actions.open();
        return;
      }
      pendingOpen = true;
      loadWallet();
    },
    disconnect: () => {
      rememberWallet(false);
      return actions?.disconnect();
    },
  };
}
