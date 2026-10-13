"use client";

import { useEffect, useState, type FormEvent } from "react";
import { DEPLOYER_WALLET } from "@/lib/admin";
import { dashboardApi, useSession } from "./session";
import { Card } from "./shell";

type Voucher = {
  code: string;
  percent: number | null;
  usdOff: number | null;
  maxUses: number | null;
  used: number;
  plan: string | null;
  expiresAt: string | null;
  active: boolean;
};

export function VoucherAdmin() {
  const session = useSession();
  const [rows, setRows] = useState<Voucher[] | null>(null);
  const [code, setCode] = useState("");
  const [percent, setPercent] = useState("");
  const [usdOff, setUsdOff] = useState("");
  const [uses, setUses] = useState("1");
  const [plan, setPlan] = useState("any");
  const [days, setDays] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    if (!session) return;
    const body = await dashboardApi<{ vouchers: Voucher[] }>("vouchers", session.token);
    setRows(body.vouchers);
  };

  useEffect(() => {
    if (!session || session.wallet !== DEPLOYER_WALLET) return;
    void load().catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Codes could not be loaded."));
  }, [session?.token, session?.wallet]);

  if (!session || session.wallet !== DEPLOYER_WALLET) return null;
  const token = session.token;

  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body: Record<string, string | number> = { code };
      if (percent.trim()) body.percent = Number(percent);
      if (usdOff.trim()) body.usdOff = Number(usdOff);
      if (uses.trim()) body.maxUses = Number(uses);
      if (plan !== "any") body.plan = plan;
      if (days.trim()) body.days = Number(days);
      await dashboardApi("vouchers", token, { method: "POST", body: JSON.stringify(body) });
      setCode("");
      setPercent("");
      setUsdOff("");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The code could not be created.");
    } finally {
      setBusy(false);
    }
  }

  async function disable(item: string) {
    setError("");
    try {
      await dashboardApi(`vouchers?code=${encodeURIComponent(item)}`, token, { method: "DELETE" });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The code could not be turned off.");
    }
  }

  return (
    <Card plain title="Codes" sub="Checkout codes for Builder and Starter. A code is used only after the payment lands.">
      <form className="ds-voucher-form" onSubmit={(event) => void create(event)}>
        <label className="m-field wide">
          <small>Code</small>
          <input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="LAUNCH20" maxLength={16} required />
        </label>
        <label className="m-field">
          <small>Percent off</small>
          <input value={percent} onChange={(event) => setPercent(event.target.value)} inputMode="numeric" placeholder="20" />
        </label>
        <label className="m-field">
          <small>Or dollars off</small>
          <input value={usdOff} onChange={(event) => setUsdOff(event.target.value)} inputMode="numeric" placeholder="5" />
        </label>
        <label className="m-field">
          <small>Uses</small>
          <input value={uses} onChange={(event) => setUses(event.target.value)} inputMode="numeric" placeholder="1, empty for unlimited" />
        </label>
        <label className="m-field">
          <small>Expires in days</small>
          <input value={days} onChange={(event) => setDays(event.target.value)} inputMode="numeric" placeholder="Optional" />
        </label>
        <label className="m-field wide">
          <small>Plan</small>
          <select value={plan} onChange={(event) => setPlan(event.target.value)}>
            <option value="any">Any plan</option>
            <option value="builder">Builder</option>
            <option value="starter">Starter</option>
          </select>
        </label>
        <button className="p-btn wide" type="submit" disabled={busy}>
          {busy ? "Saving…" : "Create code"}
        </button>
      </form>
      {error ? <p className="b-error">{error}</p> : null}
      {rows?.length ? (
        <ul className="ds-vouchers">
          {rows.map((item) => (
            <li key={item.code}>
              <b>{item.code}</b>
              <span>{item.percent != null ? `${item.percent}% off` : `$${item.usdOff} off`}</span>
              <span>
                {item.used}/{item.maxUses ?? "∞"} used
              </span>
              <span>{item.plan === "builder" ? "Builder" : item.plan === "starter" ? "Starter" : "Any plan"}</span>
              {item.active ? (
                <button type="button" className="k-act" onClick={() => void disable(item.code)}>
                  Disable
                </button>
              ) : (
                <em>Off</em>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="ds-fine">{rows ? "No codes yet." : "Loading codes…"}</p>
      )}
    </Card>
  );
}
