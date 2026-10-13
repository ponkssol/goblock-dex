"use client";

import { useEffect, useRef, useState } from "react";
import { ago, count, planName, shortDate } from "./format";
import { Icon } from "./icons";
import { dashboardApi, type ApiKey, type NewKey } from "./session";
import { Card, PageHead, useLoaded } from "./shell";

export function KeyReveal({ created, onDone }: { created: NewKey; onDone: () => void }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1400);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <div className="k-reveal" role="status">
      <div className="k-reveal-head">
        <small>New key · {created.label}</small>
        <button type="button" className="k-link" onClick={onDone}>
          Done
        </button>
      </div>
      <div className="k-secret">
        <code>{created.key}</code>
        <button
          type="button"
          className={copied ? "c-copy done" : "c-copy"}
          onClick={() => void navigator.clipboard?.writeText(created.key).then(() => setCopied(true))}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p>Copy it now and keep it on your server. goblock shows a key once and cannot show it again.</p>
    </div>
  );
}

function Row({ item, onAction, busy }: { item: ApiKey; onAction?: (action: "rotate" | "revoke") => void; busy: boolean }) {
  const [confirm, setConfirm] = useState<"rotate" | "revoke" | null>(null);

  useEffect(() => {
    if (!confirm) return;
    const timer = window.setTimeout(() => setConfirm(null), 4000);
    return () => window.clearTimeout(timer);
  }, [confirm]);

  const press = (action: "rotate" | "revoke") => {
    if (confirm !== action) return setConfirm(action);
    setConfirm(null);
    onAction?.(action);
  };
  const ended = Boolean(item.expiresAt) && Date.parse(item.expiresAt as string) <= Date.now();

  return (
    <li className={item.revokedAt ? "k-row off" : "k-row"}>
      <div className="k-name">
        <b>{item.label}</b>
        <code>{item.masked}</code>
      </div>
      <span className={item.plan === "free" || ended ? "k-pill" : "k-pill paid"}>{ended ? "Ended" : planName(item.plan)}</span>
      <dl className="k-meta">
        <div>
          <dt>Created</dt>
          <dd>{shortDate(item.createdAt)}</dd>
        </div>
        <div>
          <dt>{item.revokedAt ? "Revoked" : item.expiresAt ? "Ends" : "Last used"}</dt>
          <dd>{item.revokedAt ? shortDate(item.revokedAt) : item.expiresAt ? shortDate(item.expiresAt) : ago(item.lastUsedAt)}</dd>
        </div>
        <div>
          <dt>30 days</dt>
          <dd>{count(item.requests30d)}</dd>
        </div>
      </dl>
      {item.revokedAt || !onAction ? null : (
        <div className="k-actions">
          <button
            type="button"
            className={confirm === "rotate" ? "k-act warn" : "k-act"}
            disabled={busy}
            onClick={() => press("rotate")}
          >
            {confirm === "rotate" ? "Confirm Rotate" : "Rotate"}
          </button>
          <button
            type="button"
            className={confirm === "revoke" ? "k-act danger" : "k-act"}
            disabled={busy}
            onClick={() => press("revoke")}
          >
            {confirm === "revoke" ? "Confirm Revoke" : "Revoke"}
          </button>
        </div>
      )}
    </li>
  );
}

const SAFETY = [
  ["Keep it on your server", "Anyone who can read your app bundle can read a key shipped inside it."],
  ["Rotate if it leaks", "Rotate swaps the key for a new one with the same label. The old one stops at once."],
  ["One key per app", "Separate keys make usage easy to read and let you switch one app off alone."],
];

export function KeysView() {
  const { overview, session, refresh, created, setCreated, placeholder } = useLoaded();
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const focus = () => {
      if (window.location.hash === "#create") input.current?.focus();
    };
    focus();
    window.addEventListener("hashchange", focus);
    return () => window.removeEventListener("hashchange", focus);
  }, [overview === null]);

  if (!overview) return placeholder;
  const active = overview.keys.filter((item) => !item.revokedAt);
  const revoked = overview.keys.filter((item) => item.revokedAt);
  const full = active.length >= overview.keyLimit;

  async function run(work: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      const result = await work();
      if (result && typeof result === "object" && "key" in result) setCreated(result as NewKey);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const create = () =>
    run(async () => {
      const result = await dashboardApi<NewKey>("keys", session.token, { method: "POST", body: JSON.stringify({ label }) });
      setLabel("");
      return result;
    });

  const act = (id: string, action: "rotate" | "revoke") =>
    run(() => dashboardApi(`keys/${id}`, session.token, { method: action === "rotate" ? "POST" : "DELETE" }));

  return (
    <>
      <PageHead
        title="API Keys"
        sub={`Create, rotate, and revoke keys for /api/v1/swap. ${active.length} of ${overview.keyLimit} active.`}
      />

      <div className="ds-grid c-2-1">
        <div className="ds-stack">
          <Card plain title="Create a key" sub="Give it a label so you can tell your apps apart.">
            <form
              id="create"
              className="k-create"
              onSubmit={(event) => {
                event.preventDefault();
                void create();
              }}
            >
              <label className="m-field">
                <span className="sr-only">Key label</span>
                <input
                  ref={input}
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  placeholder="Label, e.g. Trading bot"
                  maxLength={40}
                  disabled={full}
                />
              </label>
              <button className="p-btn" type="submit" disabled={busy || full}>
                <Icon name="plus" size={16} />
                {busy ? "Working…" : "Create Key"}
              </button>
            </form>
            {created ? <KeyReveal created={created} onDone={() => setCreated(null)} /> : null}
            {full ? (
              <p className="b-warn">This wallet has {overview.keyLimit} active keys. Revoke one to create another.</p>
            ) : null}
            {error ? <p className="b-error">{error}</p> : null}
          </Card>

          <Card title="Active keys" sub={`${active.length} of ${overview.keyLimit}`}>
            {active.length ? (
              <ul className="k-list">
                {active.map((item) => (
                  <Row key={item.id} item={item} busy={busy} onAction={(action) => void act(item.id, action)} />
                ))}
              </ul>
            ) : (
              <div className="ds-empty">
                <Icon name="keys" size={22} />
                <b>No keys yet</b>
                <p>Create your first key above. It works on /api/v1/swap straight away.</p>
              </div>
            )}
          </Card>

          {revoked.length ? (
            <Card title="Revoked keys" sub="These keys are refused by the API.">
              <ul className="k-list">
                {revoked.map((item) => (
                  <Row key={item.id} item={item} busy />
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        <div className="ds-stack">
          <Card plain title="Key safety">
            <ul className="ds-tips">
              {SAFETY.map(([title, body]) => (
                <li key={title}>
                  <Icon name="shield" size={18} />
                  <div>
                    <b>{title}</b>
                    <p>{body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
          <Card plain title="How to send it">
            <p className="ds-text">
              Put the key in the <code>x-api-key</code> header of every request. A missing or revoked key returns{" "}
              <code>401</code>.
            </p>
            <pre className="ds-pre">{`curl "${typeof window === "undefined" ? "" : window.location.origin}/api/v1/key" \\\n  -H "x-api-key: $GOBLOCK_API_KEY"`}</pre>
          </Card>
        </div>
      </div>
    </>
  );
}
