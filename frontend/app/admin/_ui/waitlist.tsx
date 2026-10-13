"use client";

import { useState } from "react";
import { ago } from "../../dashboard/_ui/format";
import { Card, PageHead } from "../../dashboard/_ui/shell";
import { adminApi } from "../../dashboard/_ui/session";
import { shorten } from "@/lib/units";
import { Loading, useAdmin, type WaitRow } from "./data";

export function WaitlistView() {
  const { data, error, reload, token } = useAdmin<{ entries: WaitRow[] }>("waitlist");
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");

  if (!data) return <Loading error={error} />;

  async function remove(id: string) {
    setBusy(id);
    setNote("");
    try {
      await adminApi(`waitlist?id=${encodeURIComponent(id)}`, token, { method: "DELETE" });
      reload();
    } catch (caught) {
      setNote(caught instanceof Error ? caught.message : "That entry could not be removed.");
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <PageHead title="Waitlist" sub={`${data.entries.length} ${data.entries.length === 1 ? "person" : "people"} joined from the public page.`} />
      <Card plain title="Signups" sub="Newest first. Removing someone does not email them.">
        {note ? <p className="b-error">{note}</p> : null}
        {data.entries.length ? (
          <ul className="ds-vouchers">
            {data.entries.map((row) => (
              <li key={row.id}>
                <b>{row.email}</b>
                <span>{row.wallet ? shorten(row.wallet, 4, 4) : "No wallet"}</span>
                <span>{ago(row.createdAt)}</span>
                <button type="button" className="k-act" disabled={busy === row.id} onClick={() => void remove(row.id)}>
                  {busy === row.id ? "Removing…" : "Remove"}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ds-fine">The list is empty. Share /waitlist when you want signups.</p>
        )}
      </Card>
    </>
  );
}
