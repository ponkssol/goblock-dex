"use client";

import { useState } from "react";
import { ago, count, planName } from "../../dashboard/_ui/format";
import { Card, PageHead } from "../../dashboard/_ui/shell";
import { adminApi } from "../../dashboard/_ui/session";
import { shorten } from "@/lib/units";
import { Loading, useAdmin, type KeyRow } from "./data";

export function KeysView() {
  const { data, error, reload, token } = useAdmin<{ keys: KeyRow[] }>("keys");
  const [busy, setBusy] = useState("");
  const [confirm, setConfirm] = useState("");
  const [note, setNote] = useState("");

  if (!data) return <Loading error={error} />;
  const active = data.keys.filter((key) => !key.revokedAt).length;

  async function revoke(id: string) {
    if (confirm !== id) {
      setConfirm(id);
      return;
    }
    setBusy(id);
    setNote("");
    try {
      await adminApi(`keys/${encodeURIComponent(id)}`, token, { method: "DELETE" });
      setConfirm("");
      reload();
    } catch (caught) {
      setNote(caught instanceof Error ? caught.message : "That key could not be revoked.");
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <PageHead title="API Keys" sub={`${count(active)} active across every wallet. Revoking a key stops it at once.`} />
      <Card plain title="All keys" sub="Free keys and paid keys, newest active ones first.">
        {note ? <p className="b-error">{note}</p> : null}
        {data.keys.length ? (
          <ul className="ds-vouchers">
            {data.keys.map((key) => (
              <li key={key.id}>
                <b>{key.label}</b>
                <span>{key.masked}</span>
                <span>{planName(key.plan)}</span>
                <span>{shorten(key.wallet, 4, 4)}</span>
                <span>{count(key.requests30d)} in 30d</span>
                <span>{key.revokedAt ? `Revoked ${ago(key.revokedAt)}` : `Used ${ago(key.lastUsedAt)}`}</span>
                {key.revokedAt ? (
                  <em>Off</em>
                ) : (
                  <button type="button" className={confirm === key.id ? "k-act danger" : "k-act"} disabled={busy === key.id} onClick={() => void revoke(key.id)}>
                    {busy === key.id ? "Revoking…" : confirm === key.id ? "Confirm" : "Revoke"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="ds-fine">No keys have been created.</p>
        )}
      </Card>
    </>
  );
}
