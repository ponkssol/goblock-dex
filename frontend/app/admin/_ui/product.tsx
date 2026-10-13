"use client";

import { useEffect, useState } from "react";
import { Card, PageHead } from "../../dashboard/_ui/shell";
import { adminApi } from "../../dashboard/_ui/session";
import { Loading, useAdmin } from "./data";

export type Settings = {
  builderUsd: number;
  starterUsd: number;
  freeRpm: number;
  builderRpm: number;
  starterRpm: number;
  stableBps: number;
  majorBps: number;
  otherBps: number;
  curveBps: number;
  brandBps: number;
  platformMinBps: number;
  platformMaxBps: number;
  checkoutWallet: string;
  treasury: string;
};

const FIELDS = {
  pricing: [
    ["builderUsd", "Builder price", "USD charged at checkout, before a discount code."],
    ["starterUsd", "Starter price", "USD charged at checkout, before a discount code."],
  ],
  limits: [
    ["freeRpm", "Free key", "Requests per minute. A lapsed monthly key falls back to this."],
    ["builderRpm", "Builder", "Requests per minute while the key is paid."],
    ["starterRpm", "Starter", "Must be at least the Builder cap."],
  ],
  fees: [
    ["stableBps", "Stablecoin or LST", "Basis points when the other side is a stablecoin or an LST."],
    ["majorBps", "Major token", "Basis points on SOL paired with a major token."],
    ["otherBps", "Other pool token", "Basis points on SOL paired with any other pool token."],
    ["curveBps", "Bonding curve", "Basis points on a Pump bonding-curve swap."],
    ["brandBps", "Brand link", "Basis points on a branded link. Half goes to the brand wallet."],
    ["platformMinBps", "Platform fee minimum", "The lowest platformFeeBps an integrator can send."],
    ["platformMaxBps", "Platform fee maximum", "The highest platformFeeBps an integrator can send."],
  ],
} as const;

const COPY = {
  pricing: {
    title: "Pricing",
    sub: "Builder and Starter prices. The next checkout uses these. A code still discounts them.",
    save: "Save pricing",
  },
  limits: {
    title: "Rate limits",
    sub: "Requests per minute. A new quote uses the cap for that key's plan.",
    save: "Save rate limits",
  },
  fees: {
    title: "Fees",
    sub: "Free-key and brand-link rates, in basis points. A monthly plan still adds 0 bps. goblock keeps 10% of a platform fee.",
    save: "Save fees",
  },
} as const;

export function ProductSettings({ section }: { section: keyof typeof FIELDS }) {
  const { data, error, reload, token } = useAdmin<Settings>("settings");
  const [draft, setDraft] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  const copy = COPY[section];

  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);

  if (!draft) return <Loading error={error} />;

  async function save() {
    if (!draft) return;
    setBusy(true);
    setNote("");
    setSaved(false);
    try {
      await adminApi<Settings>("settings", token, { method: "PUT", body: JSON.stringify(draft) });
      setSaved(true);
      reload();
    } catch (caught) {
      setNote(caught instanceof Error ? caught.message : "Settings could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead title={copy.title} sub={copy.sub} />
      <Card plain title={copy.title} sub="Whole numbers. The change applies to the next request.">
        <form
          className="ds-voucher-form"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          {FIELDS[section].map(([key, label, hint]) => (
            <label className="m-field" key={key}>
              <small>{label}</small>
              <input
                value={String(draft[key])}
                inputMode="numeric"
                onChange={(event) => {
                  const raw = event.target.value.replace(/[^\d]/g, "");
                  setSaved(false);
                  setDraft({ ...draft, [key]: raw === "" ? 0 : Number(raw) });
                }}
              />
              <em>{hint}</em>
            </label>
          ))}
          <button className="p-btn wide" type="submit" disabled={busy}>
            {busy ? "Saving…" : copy.save}
          </button>
        </form>
        {note ? <p className="b-error">{note}</p> : null}
        {saved ? <p className="ds-fine">Saved.</p> : null}
        {section === "fees" ? (
          <dl className="k-fees">
            <div>
              <dt>Subscription wallet</dt>
              <dd>
                <code>{draft.checkoutWallet}</code>
              </dd>
            </div>
            <div>
              <dt>Swap fee vault</dt>
              <dd>
                <code>{draft.treasury}</code>
              </dd>
            </div>
          </dl>
        ) : null}
      </Card>
    </>
  );
}
