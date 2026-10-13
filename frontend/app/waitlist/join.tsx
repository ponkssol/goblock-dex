"use client";

import { useState, type FormEvent } from "react";

export function WaitlistJoin() {
  const [email, setEmail] = useState("");
  const [wallet, setWallet] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, wallet }),
      });
      const body = (await response.json().catch(() => ({}))) as { msg?: string };
      if (!response.ok) throw new Error(body.msg ?? "The list could not be updated. Try again.");
      setDone(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The list could not be updated. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="c-pay-card w-join">
        <h2>You are on the list.</h2>
        <p>We will use {email} when there is something to share. Joining does not create an API key.</p>
      </div>
    );
  }

  return (
    <form className="c-pay-card w-join" onSubmit={(event) => void submit(event)}>
      <h2>Join the list</h2>
      <p>Leave an email. A Solana wallet is optional, and it is only stored so we know who asked.</p>
      <label className="m-field">
        <small>Email</small>
        <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required maxLength={120} placeholder="you@domain.com" />
      </label>
      <label className="m-field">
        <small>Wallet</small>
        <input value={wallet} onChange={(event) => setWallet(event.target.value)} autoComplete="off" placeholder="Optional" spellCheck={false} />
      </label>
      {error ? <p className="c-pay-error">{error}</p> : null}
      <button className="p-btn" type="submit" disabled={busy}>
        {busy ? "Saving…" : "Join the waitlist"}
      </button>
    </form>
  );
}
