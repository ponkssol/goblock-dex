"use client";

import { useEffect, useState } from "react";
import { solscan } from "./format";
import { Icon } from "./icons";
import { dashboardApi, saveSession } from "./session";
import { Card, PageHead, useLoaded } from "./shell";
export function SettingsView() {
  const { overview, session, refresh, placeholder } = useLoaded();
  const [origin, setOrigin] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => setOrigin(window.location.origin), []);

  useEffect(() => {
    if (!confirm) return;
    const timer = window.setTimeout(() => setConfirm(false), 4000);
    return () => window.clearTimeout(timer);
  }, [confirm]);

  if (!overview) return placeholder;
  const active = overview.keys.filter((key) => !key.revokedAt);

  async function revokeAll() {
    if (!confirm) return setConfirm(true);
    setConfirm(false);
    setBusy(true);
    setMessage("");
    try {
      for (const key of active) {
        await dashboardApi(`keys/${key.id}`, session.token, { method: "DELETE" });
      }
      setMessage(`Revoked ${active.length} ${active.length === 1 ? "key" : "keys"}.`);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Some keys could not be revoked.");
    } finally {
      setBusy(false);
      void refresh();
    }
  }

  const rows: [string, string][] = [
    ["Base URL", `${origin}/api/v1`],
    ["Swap endpoint", "GET /api/v1/swap"],
    ["Key header", "x-api-key"],
    ["Key check", "GET /api/v1/key"],
  ];

  return (
    <>
      <PageHead title="Settings" sub="Your sign-in, the API details, and account actions." />

      <div className="ds-grid c-1-1">
        <Card title="Account" sub="Keys belong to this wallet">
          <div className="ds-field">
            <small>Wallet</small>
            <code>{session.wallet}</code>
          </div>
          <div className="ds-field">
            <small>Session ends</small>
            <span>
              {new Date(session.expiresAt).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          <div className="k-buttons">
            <a className="p-btn line" href={solscan(`account/${session.wallet}`)} target="_blank" rel="noreferrer">
              View on Solscan
              <Icon name="arrow" size={16} />
            </a>
            <button className="p-btn line" type="button" onClick={() => saveSession(null)}>
              <Icon name="out" size={16} />
              Sign Out
            </button>
          </div>
        </Card>

        <Card plain title="API" sub="Use these in your app">
          <dl className="k-fees">
            {rows.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>
                  <code>{value}</code>
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <Card plain title="Danger zone" className="ds-danger" sub="This cannot be undone.">
        <div className="ds-danger-row">
          <div>
            <b>Revoke every key</b>
            <p>All {active.length} active keys stop working at once. Apps using them get 401 until you add a new key.</p>
          </div>
          <button
            type="button"
            className={confirm ? "k-act danger" : "k-act"}
            disabled={busy || active.length === 0}
            onClick={() => void revokeAll()}
          >
            {busy ? "Revoking…" : confirm ? "Confirm Revoke All" : "Revoke All Keys"}
          </button>
        </div>
        {message ? <p className="ds-fine">{message}</p> : null}
      </Card>
    </>
  );
}
