"use client";

import { VersionedTransaction } from "@solana/web3.js";
import { useState } from "react";
import { formatAtomic, shorten } from "@/lib/units";
import { watchSignature } from "../solana";
import { useGoblockWallet } from "../wallet";
import { sol, solscan, useBuybackState } from "./state";

type Result = { ok: boolean; signature: string; detail: string };

export function VaultCard() {
  const { state, error } = useBuybackState();
  const progress = state ? Math.min(100, (state.pendingLamports / state.thresholdLamports) * 100) : 0;

  return (
    <div className="m-chat b-card">
      <div className="m-chat-tab">
        <i className="p-bill-dot" />
        Fee vault
        <em>Live</em>
      </div>
      <div className="m-chat-body p-bill">
        <div className="p-bill-price">
          <strong>{state ? sol(state.pendingLamports, 3) : "—"}</strong>
          <span>/ {state ? sol(state.thresholdLamports, 1) : "0.1"} SOL</span>
        </div>
        <div className="b-bar" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
          <i style={{ width: `${progress}%` }} />
        </div>
        <dl>
          <div>
            <dt>Held for buyback</dt>
            <dd>{state ? `${sol(state.reservedLamports)} SOL` : "—"}</dd>
          </div>
          <div>
            <dt>Vault balance</dt>
            <dd>{state ? `${sol(state.vaultLamports)} SOL` : "—"}</dd>
          </div>
          <div>
            <dt>Buyback token</dt>
            <dd>{state?.mint ? shorten(state.mint, 4, 4) : "Not set yet"}</dd>
          </div>
        </dl>
        <div className="m-approve">
          <span>
            <small>{state?.splitReady ? "Ready to split" : "Splits at 0.1 SOL"}</small>
            40% buyback and burn, 60% team
          </span>
          <i>{state ? `${Math.floor(progress)}%` : "…"}</i>
        </div>
        {error ? <p className="b-error">{error}</p> : null}
      </div>
    </div>
  );
}

export function BuybackBoard() {
  const { state, error, refresh } = useBuybackState();
  const { publicKey, connected, openWallet, sendTransaction } = useGoblockWallet();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const ready = Boolean(state && (state.splitReady || state.buyReady));
  const burned =
    state && state.mintDecimals !== null ? Number(formatAtomic(state.totals.burned, state.mintDecimals, 0)) : 0;

  async function distribute() {
    if (!publicKey) return;
    setBusy(true);
    setResult(null);
    let signature = "";
    try {
      const response = await fetch(`/api/buyback/distribute?payer=${publicKey.toBase58()}`, { cache: "no-store" });
      const body = (await response.json()) as { transaction?: string; lastValidBlockHeight?: number; msg?: string };
      if (!response.ok || !body.transaction) throw new Error(body.msg ?? "The distribution is not available.");
      const bytes = Uint8Array.from(atob(body.transaction), (char) => char.charCodeAt(0));
      signature = await sendTransaction(VersionedTransaction.deserialize(bytes));
      const outcome = body.lastValidBlockHeight
        ? await watchSignature(signature, body.lastValidBlockHeight).catch(() => "expired" as const)
        : "confirmed";
      if (outcome === "failed") setResult({ ok: false, signature, detail: "The transaction failed on the network." });
      else if (outcome === "expired") setResult({ ok: false, signature, detail: "The transaction expired before it confirmed." });
      else setResult({ ok: true, signature, detail: "" });
    } catch (caught) {
      const detail = caught instanceof Error ? caught.message : "The distribution failed.";
      setResult({ ok: false, signature, detail: /reject|cancel/i.test(detail) ? "You cancelled the transaction." : detail });
    } finally {
      setBusy(false);
      void refresh();
    }
  }

  const stats = [
    ["Paid to team", state ? `${sol(state.totals.teamLamports)} SOL` : "—"],
    ["Spent on buyback", state ? `${sol(state.totals.buybackLamports)} SOL` : "—"],
    ["Tokens burned", state ? burned.toLocaleString("en-US") : "—"],
    ["Rounds", state ? Number(state.totals.rounds).toLocaleString("en-US") : "—"],
  ];

  const links = state
    ? [
        ["Fee vault", state.vault, solscan(`account/${state.vault}`)],
        ["Vault ledger", state.config, solscan(`account/${state.config}`)],
        ["Team wallet", state.team, solscan(`account/${state.team}`)],
        ["Program", state.programId, solscan(`account/${state.programId}`)],
        ...(state.mint ? [["$GOBLOCK", state.mint, solscan(`token/${state.mint}`)]] : []),
      ]
    : [];

  return (
    <div className="b-board">
      <ul className="b-stats">
        {stats.map(([label, value]) => (
          <li key={label}>
            <small>{label}</small>
            <strong>{value}</strong>
          </li>
        ))}
      </ul>

      <div className="b-run">
        <div>
          <b>Run the split</b>
          <p>
            Anyone can trigger it once the vault holds 0.1 SOL of new fees. You only pay the network fee. The program
            decides where every lamport goes.
          </p>
        </div>
        {connected ? (
          <button className="p-btn" type="button" disabled={!ready || busy} onClick={() => void distribute()}>
            {busy ? "Distributing…" : ready ? "Distribute Now" : "Waiting for 0.1 SOL"}
          </button>
        ) : (
          <button className="p-btn" type="button" onClick={openWallet}>
            Connect Wallet
          </button>
        )}
      </div>
      {result ? (
        <p className={result.ok ? "b-done" : "b-error"}>
          {result.ok ? "Distributed. " : `${result.detail} `}
          {result.signature ? (
            <a href={solscan(`tx/${result.signature}`)} target="_blank" rel="noreferrer">
              View on Solscan
            </a>
          ) : null}
        </p>
      ) : null}
      {error ? <p className="b-error">{error}</p> : null}

      <ul className="b-links">
        {links.map(([label, address, href]) => (
          <li key={label}>
            <small>{label}</small>
            <a href={href} target="_blank" rel="noreferrer">
              {shorten(address, 6, 6)}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
