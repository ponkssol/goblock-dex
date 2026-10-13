"use client";

import { VersionedTransaction } from "@solana/web3.js";
import { useEffect, useState } from "react";
import { isMint } from "@/lib/tokens";
import { shorten } from "@/lib/units";
import { watchSignature } from "../../solana";
import { useGoblockWallet } from "../../wallet";
import { solscan, useBuybackState } from "../state";

const LEDGER_RENT = 1_500_000;
const TEAM_WALLET = "CwVD4jd6BeLAWZeEqMFerD8bLoQevSy5rmwawFTa3nuo";

export function MintForm() {
  const { state, error, refresh } = useBuybackState(30_000);
  const { connection, publicKey, connected, openWallet, sendTransaction } = useGoblockWallet();
  const [mint, setMint] = useState("");
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string; signature: string } | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const team = state?.team ?? TEAM_WALLET;
  const isTeam = publicKey?.toBase58() === team;
  const value = mint.trim();
  const valid = isMint(value);

  useEffect(() => {
    if (!publicKey || !isTeam) {
      setBalance(null);
      return;
    }
    let alive = true;
    void connection
      .getBalance(publicKey, "confirmed")
      .then((lamports) => alive && setBalance(lamports))
      .catch(() => alive && setBalance(null));
    return () => {
      alive = false;
    };
  }, [connection, publicKey, isTeam]);

  async function save() {
    if (!valid || !sure) return;
    setBusy(true);
    setMessage(null);
    let signature = "";
    try {
      const response = await fetch(`/api/buyback/set-mint?mint=${value}`, { cache: "no-store" });
      const body = (await response.json()) as { transaction?: string; lastValidBlockHeight?: number; msg?: string };
      if (!response.ok || !body.transaction) throw new Error(body.msg ?? "The transaction is not available.");
      const bytes = Uint8Array.from(atob(body.transaction), (char) => char.charCodeAt(0));
      signature = await sendTransaction(VersionedTransaction.deserialize(bytes));
      const outcome = body.lastValidBlockHeight
        ? await watchSignature(signature, body.lastValidBlockHeight).catch(() => "expired" as const)
        : "confirmed";
      if (outcome === "confirmed") setMessage({ ok: true, text: "Saved and locked.", signature });
      else setMessage({ ok: false, text: outcome === "failed" ? "The transaction failed." : "The transaction expired.", signature });
    } catch (caught) {
      const text = caught instanceof Error ? caught.message : "The contract address was not saved.";
      setMessage({ ok: false, text: /reject|cancel/i.test(text) ? "You cancelled the transaction." : text, signature });
    } finally {
      setBusy(false);
      void refresh();
    }
  }

  if (state?.mint) {
    return (
      <div className="b-settings">
        <b>$GOBLOCK is locked in.</b>
        <p>The program will only buy and burn this token. It cannot be changed.</p>
        <div className="b-lock">
          <small>Contract address</small>
          <a href={solscan(`token/${state.mint}`)} target="_blank" rel="noreferrer">
            {state.mint}
          </a>
        </div>
        {message?.ok && message.signature ? (
          <p className="b-done">
            {message.text}{" "}
            <a href={solscan(`tx/${message.signature}`)} target="_blank" rel="noreferrer">
              View on Solscan
            </a>
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="b-settings">
      <b>Set the $GOBLOCK contract address</b>
      <p>
        Paste the mint from pump.fun after launch. The program checks it is a real token, saves it, and locks it for
        good.
      </p>

      <div className="b-lock">
        <small>Team wallet</small>
        <code>{team}</code>
      </div>

      {!connected ? (
        <button className="p-btn" type="button" onClick={openWallet} style={{ border: 0, cursor: "pointer" }}>
          Connect Team Wallet
        </button>
      ) : !isTeam ? (
        <p className="b-warn">
          {publicKey ? shorten(publicKey.toBase58(), 4, 4) : "This wallet"} is not the team wallet. Only{" "}
          {shorten(team, 4, 4)} can set the contract address.
        </p>
      ) : (
        <form
          className="b-form"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <label className="m-field">
            <small>Contract address</small>
            <input
              value={mint}
              onChange={(event) => setMint(event.target.value)}
              placeholder="Paste the $GOBLOCK mint"
              spellCheck={false}
              autoComplete="off"
            />
            {value && !valid ? <em>That is not a Solana address.</em> : null}
          </label>
          <label className="m-row">
            <span>I checked this address. It cannot be changed later.</span>
            <input type="checkbox" checked={sure} onChange={(event) => setSure(event.target.checked)} />
          </label>
          {balance !== null && balance < LEDGER_RENT + 10_000 ? (
            <p className="b-warn">
              The team wallet needs about 0.0016 SOL to open the vault ledger. Add a little SOL first.
            </p>
          ) : null}
          <button className="p-btn" type="submit" disabled={!valid || !sure || busy}>
            {busy ? "Saving…" : "Save and Lock"}
          </button>
        </form>
      )}

      {message ? (
        <p className={message.ok ? "b-done" : "b-error"}>
          {message.text}{" "}
          {message.signature ? (
            <a href={solscan(`tx/${message.signature}`)} target="_blank" rel="noreferrer">
              View on Solscan
            </a>
          ) : null}
        </p>
      ) : null}
      {error ? <p className="b-error">{error}</p> : null}
    </div>
  );
}
