"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { shorten } from "@/lib/units";
import { useGoblockWallet } from "../../wallet";
import { Icon, type IconName } from "./icons";
import { saveSession, type Session } from "./session";

function toBase64(bytes: Uint8Array) {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
}

export function useSignIn() {
  const { publicKey, connected, openWallet, disconnect, signMessage } = useGoblockWallet();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const address = publicKey?.toBase58() ?? "";

  async function signIn() {
    if (!address) return;
    setBusy(true);
    setError("");
    try {
      const challenge = await fetch(`/api/dashboard/session?wallet=${address}`, { cache: "no-store" });
      const ask = (await challenge.json()) as { message?: string; issuedAt?: string; msg?: string };
      if (!challenge.ok || !ask.message) throw new Error(ask.msg ?? "Sign-in is not available right now.");
      const signature = toBase64(await signMessage(new TextEncoder().encode(ask.message)));
      const response = await fetch("/api/dashboard/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet: address, issuedAt: ask.issuedAt, signature }),
      });
      const body = (await response.json()) as Session & { msg?: string };
      if (!response.ok) throw new Error(body.msg ?? "Sign-in failed.");
      saveSession({ wallet: body.wallet, token: body.token, expiresAt: body.expiresAt });
    } catch (caught) {
      const text = caught instanceof Error ? caught.message : "Sign-in failed.";
      setError(/reject|cancel|denied|declined/i.test(text) ? "You cancelled the request in your wallet." : text);
    } finally {
      setBusy(false);
    }
  }

  return { address, connected, openWallet, disconnect, signIn, busy, error };
}

const INSIDE: [IconName, string, string][] = [
  ["keys", "API keys", "Create up to five keys, then rotate or revoke them in one click."],
  ["usage", "Usage", "Requests and errors for each key, day by day."],
  ["earnings", "Earnings", "The SOL your fee wallets received, read from Solana."],
  ["play", "Playground", "Send a real quote request and read the response."],
];

const TRUST = ["Free. No transaction is sent.", "No email or password.", "You stay signed in for 7 days."];

export function SignInScreen({
  title = "Sign in to the API Console",
  lead = "Use the Solana wallet you trade with. There is no email or password.",
  chip = "API Console",
  asideTitle = "Run your swap API from one place.",
  asideBody = "Everything for the keys behind your app, tied to the wallet that owns them.",
  inside = INSIDE,
  alt = { href: "/docs/authentication", label: "Get a free key without signing in" },
}: {
  title?: string;
  lead?: string;
  chip?: string;
  asideTitle?: string;
  asideBody?: string;
  inside?: [IconName, string, string][];
  alt?: { href: string; label: string } | null;
} = {}) {
  const { address, connected, openWallet, disconnect, signIn, busy, error } = useSignIn();
  const [want, setWant] = useState(false);

  useEffect(() => {
    if (!want || !connected || !address) return;
    setWant(false);
    void signIn();
  }, [want, connected, address]);

  const step = connected ? 2 : 1;

  return (
    <div className="ds-gate">
      <div className="au">
        <section className="au-main">
          <header className="au-top">
            <Link href="/" className="ds-logo" aria-label="goblock home">
              <img src="/goblock%20logo%20wordmark.png?v=2" alt="goblock" width={973} height={235} />
            </Link>
            <Link href="/" className="ds-ghost">
              <Icon name="back" size={16} />
              Back to goblock
            </Link>
          </header>

          <div className="au-box">
            <span className="au-badge">
              <Icon name="keys" size={16} />
            </span>
            <h1>{title}</h1>
            <p className="au-lead">{lead}</p>

            <ol className="au-progress" aria-label="Sign-in steps">
              <li className={step > 1 ? "done" : "now"}>
                <span>{step > 1 ? <Icon name="check" size={12} /> : 1}</span>
                Connect wallet
              </li>
              <li className={step === 2 ? "now" : undefined}>
                <span>2</span>
                Approve sign-in
              </li>
            </ol>

            {connected ? (
              <div className="au-wallet">
                <i aria-hidden="true">{address.slice(0, 2)}</i>
                <div>
                  <small>Connected wallet</small>
                  <b>{shorten(address, 6, 6)}</b>
                </div>
                <button type="button" className="au-switch" disabled={busy} onClick={() => void disconnect()}>
                  Change
                </button>
              </div>
            ) : null}

            {connected ? (
              <button className="p-btn au-go" type="button" disabled={busy} onClick={() => void signIn()}>
                {busy ? <span className="au-spin" aria-hidden="true" /> : <Icon name="check" size={18} />}
                {busy ? "Approve in your wallet…" : "Sign In"}
              </button>
            ) : (
              <button
                className="p-btn au-go"
                type="button"
                onClick={() => {
                  setWant(true);
                  openWallet();
                }}
              >
                <Icon name="wallet" size={18} />
                Connect Wallet
              </button>
            )}

            <p className="au-hint">
              {connected
                ? "Your wallet shows a short sign-in message. Approving it is free and sends no transaction."
                : "Phantom, Solflare, Backpack, and other Solana wallets work. You approve one message after connecting."}
            </p>

            {error ? (
              <div className="au-error" role="alert">
                <b>Sign-in did not finish</b>
                <p>{error} Press Sign In to try again.</p>
              </div>
            ) : null}

            <ul className="au-trust">
              {TRUST.map((line) => (
                <li key={line}>
                  <Icon name="check" size={14} />
                  {line}
                </li>
              ))}
            </ul>

            {alt ? (
              <div className="au-alt">
                <span>Looking for something else?</span>
                <Link href={alt.href}>
                  {alt.label}
                  <Icon name="arrow" size={14} />
                </Link>
              </div>
            ) : null}
          </div>
        </section>

        <aside className="au-side" aria-label="What is inside">
          <img className="au-mark" src="/goblock-mark.png" alt="" aria-hidden="true" />
          <div className="au-side-copy">
            <span className="ds-chip">
              <i />
              {chip}
            </span>
            <h2>{asideTitle}</h2>
            <p>{asideBody}</p>
          </div>
          <ul className="au-list">
            {inside.map(([icon, itemTitle, body]) => (
              <li key={itemTitle}>
                <span>
                  <Icon name={icon} size={18} />
                </span>
                <div>
                  <b>{itemTitle}</b>
                  <small>{body}</small>
                </div>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
