"use client";

import { isMint } from "@/lib/tokens";
import { useEffect, useMemo, useState } from "react";

const NAME = /^[\p{L}\p{N} ._-]+$/u;

export function BrandForm() {
  const [name, setName] = useState("");
  const [wallet, setWallet] = useState("");
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const trimmed = name.trim().replace(/\s+/g, " ");
  const nameError =
    trimmed.length === 0
      ? ""
      : trimmed.length > 32
        ? "Use 32 characters or fewer."
        : NAME.test(trimmed)
          ? ""
          : "Use letters, numbers, spaces, periods, or dashes.";
  const walletError = wallet.trim().length === 0 || isMint(wallet.trim()) ? "" : "That is not a Solana address.";
  const ready = trimmed.length > 0 && !nameError && isMint(wallet.trim());

  const href = useMemo(() => {
    const params = new URLSearchParams({ brand: trimmed, brandWallet: wallet.trim() });
    return `${origin}/?${params.toString()}`;
  }, [origin, trimmed, wallet]);

  async function copy() {
    if (!ready) return;
    await navigator.clipboard.writeText(href);
    setCopied(true);
  }

  return (
    <div className="form-card stack">
      <label className="field">
        <span>Brand name</span>
        <input
          maxLength={32}
          placeholder="Shown in the swap memo"
          value={name}
          onChange={(event) => {
            setCopied(false);
            setName(event.target.value);
          }}
        />
      </label>
      {nameError ? <p className="status error">{nameError}</p> : null}
      <label className="field">
        <span>Brand wallet</span>
        <input
          spellCheck={false}
          placeholder="Receives half of the link fee"
          value={wallet}
          onChange={(event) => {
            setCopied(false);
            setWallet(event.target.value);
          }}
        />
      </label>
      {walletError ? <p className="status error">{walletError}</p> : null}
      <div className="link-preview" aria-live="polite">
        {ready ? href : "Add a name and a wallet to build the link."}
      </div>
      <button className="swap" type="button" disabled={!ready} onClick={() => void copy()}>
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
