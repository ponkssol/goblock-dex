"use client";

import Link from "next/link";
import { shorten } from "@/lib/units";
import { Legend, Sparkline, UsageChart } from "./chart";
import { ago, average, count, percent, sol } from "./format";
import { Icon } from "./icons";
import { Card, Kpi, useEarnings, useLoaded } from "./shell";

export function OverviewView() {
  const { overview, session, placeholder } = useLoaded();
  const { earnings } = useEarnings();
  if (!overview) return placeholder;

  const paid = overview.plan === "paid";
  const days = overview.usage;
  const today = days[days.length - 1];
  const month = days.reduce((sum, day) => sum + day.requests, 0);
  const week = days.slice(-7).reduce((sum, day) => sum + day.requests, 0);
  const failed = days.reduce((sum, day) => sum + day.errors, 0);
  const active = overview.keys.filter((key) => !key.revokedAt);
  const lastUsed = overview.keys.reduce<string | null>(
    (latest, key) => (key.lastUsedAt && (!latest || key.lastUsedAt > latest) ? key.lastUsedAt : latest),
    null,
  );
  const recent = [...active]
    .sort((a, b) => Date.parse(b.lastUsedAt ?? b.createdAt) - Date.parse(a.lastUsedAt ?? a.createdAt))
    .slice(0, 5);
  const ranked = [...overview.keys].filter((key) => key.requests30d > 0).sort((a, b) => b.requests30d - a.requests30d);
  const peak = Math.max(1, ...ranked.map((key) => key.requests30d));
  const earned = earnings?.reduce((sum, row) => sum + row.lamports, 0) ?? 0;
  const paidSwaps = earnings?.reduce((sum, row) => sum + row.swaps, 0) ?? 0;
  const bps = overview.fees.map((fee) => fee.bps);
  const feeRange = paid ? "0 bps" : `${Math.min(...bps)}–${Math.max(...bps)} bps`;

  const steps = [
    { done: active.length > 0, title: "Create an API key", body: "Label it after the app that will use it.", href: "/dashboard/keys#create" },
    { done: month > 0, title: "Make a first request", body: "Quote 0.01 SOL into USDC with your key.", href: "/dashboard/quickstart" },
    { done: overview.feeWallets.length > 0, title: "Charge your own fee", body: "Send platformFeeBps and a feeWallet.", href: "/dashboard/earnings" },
  ];
  const finished = steps.filter((step) => step.done).length;

  return (
    <>
      <section className="ds-hero">
        <img className="ds-hero-mark" src="/goblock-mark.png" alt="" aria-hidden="true" />
        <div className="ds-hero-copy">
          <span className="ds-chip">
            <i />
            {paid ? "Monthly plan" : "Free plan"}
          </span>
          <h1>Welcome back.</h1>
          <p>
            Signed in as <b>{shorten(session.wallet, 4, 4)}</b>. {active.length} of {overview.keyLimit} keys are active,
            and they made {count(month)} {month === 1 ? "request" : "requests"} in the last 30 days.
          </p>
          <div className="ds-hero-actions">
            <Link className="ds-go" href="/dashboard/keys#create">
              <Icon name="plus" size={16} />
              Create Key
            </Link>
            <Link className="ds-demo" href="/dashboard/usage">
              View Usage
              <span>
                <Icon name="arrow" size={16} />
              </span>
            </Link>
          </div>
        </div>

        <div className="ds-hero-card">
          <div className="ds-hero-tab">
            <i />
            Today
            <em>UTC</em>
          </div>
          <div className="ds-hero-body">
            <div className="ds-hero-big">
              <strong>{count(today.requests)}</strong>
              <span>{today.requests === 1 ? "request" : "requests"}</span>
            </div>
            <dl>
              <div>
                <dt>Errors</dt>
                <dd>{count(today.errors)}</dd>
              </div>
              <div>
                <dt>Success rate</dt>
                <dd>{percent(today.requests - today.errors, today.requests)}</dd>
              </div>
              <div>
                <dt>Last request</dt>
                <dd>{ago(lastUsed)}</dd>
              </div>
            </dl>
            <div className="ds-hero-fee">
              <span>
                <small>goblock fee on your swaps</small>
                {paid ? "Your plan adds no swap fee." : "Paid in SOL, only when it lands."}
              </span>
              <i>{feeRange}</i>
            </div>
          </div>
        </div>
      </section>

      <ul className="ds-kpis">
        <Kpi icon="usage" label="Requests" value={count(month)} foot={`Last 30 days, ${average(month, 30)} a day`}>
          <Sparkline values={days.map((day) => day.requests)} />
        </Kpi>
        <Kpi
          icon="shield"
          label="Error rate"
          value={percent(failed, month)}
          foot={month ? `${count(failed)} of ${count(month)} failed` : "No requests yet"}
          tone={failed > 0 ? "down" : undefined}
        >
          <div className="ds-meter bad">
            <i style={{ width: month ? `${(failed / month) * 100}%` : "0%" }} />
          </div>
        </Kpi>
        <Kpi
          icon="keys"
          label="Active keys"
          value={`${active.length} / ${overview.keyLimit}`}
          foot={`${overview.keyLimit - active.length} ${overview.keyLimit - active.length === 1 ? "slot" : "slots"} left`}
        >
          <div className="ds-meter">
            <i style={{ width: `${(active.length / overview.keyLimit) * 100}%` }} />
          </div>
        </Kpi>
        <Kpi
          icon="earnings"
          label="Earned"
          value={earnings ? `${sol(earned)} SOL` : "…"}
          foot={
            earnings
              ? earnings.length
                ? `${count(paidSwaps)} ${paidSwaps === 1 ? "swap" : "swaps"} to ${earnings.length} fee ${earnings.length === 1 ? "wallet" : "wallets"}`
                : "Add platformFeeBps to earn"
              : "Reading from Solana"
          }
          tone={earned > 0 ? "up" : undefined}
        >
          <Link className="k-link ds-kpi-link" href="/dashboard/earnings">
            Earnings
            <Icon name="arrow" size={14} />
          </Link>
        </Kpi>
      </ul>

      <div className="ds-grid c-2-1">
        <Card title="Requests" sub="Last 30 days, UTC" action={<Legend />}>
          <UsageChart days={days} />
        </Card>

        {finished < steps.length ? (
          <Card plain title="Get started" sub={`${finished} of ${steps.length} done`}>
            <div className="ds-progress">
              <i style={{ width: `${(finished / steps.length) * 100}%` }} />
            </div>
            <ol className="ds-check">
              {steps.map((step) => (
                <li key={step.title} className={step.done ? "done" : undefined}>
                  <span>{step.done ? <Icon name="check" size={14} /> : null}</span>
                  <Link href={step.href}>
                    <b>{step.title}</b>
                    <small>{step.body}</small>
                  </Link>
                </li>
              ))}
            </ol>
          </Card>
        ) : (
          <Card
            plain
            title="Top keys"
            sub="By requests in the last 30 days"
            action={
              <Link className="k-link" href="/dashboard/usage">
                Usage
              </Link>
            }
          >
            {ranked.length ? (
              <ul className="ds-bars">
                {ranked.slice(0, 5).map((key) => (
                  <li key={key.id} className={key.revokedAt ? "off" : undefined}>
                    <div>
                      <b>{key.label}</b>
                      <span>{count(key.requests30d)}</span>
                    </div>
                    <i>
                      <em style={{ width: `${(key.requests30d / peak) * 100}%` }} />
                    </i>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ds-text">No requests in the last 30 days.</p>
            )}
            <dl className="ds-mini">
              {(
                [
                  ["Today", today.requests],
                  ["7 days", week],
                  ["30 days", month],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{count(value)}</dd>
                </div>
              ))}
            </dl>
          </Card>
        )}
      </div>

      <div className="ds-grid c-2-1">
        <Card
          title="Recent keys"
          sub="Active keys, latest use first"
          action={
            <Link className="k-link" href="/dashboard/keys">
              Manage
            </Link>
          }
        >
          {recent.length ? (
            <table className="ds-table">
              <thead>
                <tr>
                  <th>Key</th>
                  <th className="ds-opt">Last used</th>
                  <th className="num">Today</th>
                  <th className="num">30 days</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((key) => (
                  <tr key={key.id}>
                    <td>
                      <b>{key.label}</b>
                      <code>{key.masked}</code>
                    </td>
                    <td className="ds-opt">{ago(key.lastUsedAt)}</td>
                    <td className="num">{count(key.requestsToday)}</td>
                    <td className="num">{count(key.requests30d)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="ds-empty">
              <Icon name="keys" size={22} />
              <b>No keys yet</b>
              <p>Create a key to start calling the swap API.</p>
              <Link className="p-btn" href="/dashboard/keys#create">
                Create Key
              </Link>
            </div>
          )}
        </Card>

        <Card
          plain
          title="Your plan"
          action={<span className={paid ? "k-pill paid" : "k-pill"}>{paid ? "Monthly" : "Free"}</span>}
        >
          <div className="ds-big">
            <strong>{feeRange}</strong>
          </div>
          <p className="ds-text">
            {paid ? "Your swaps carry no goblock fee." : "Charged in SOL on the SOL side of a swap, by pair."}
          </p>
          {paid ? null : (
            <dl className="k-fees">
              {overview.fees.slice(0, 4).map((fee) => (
                <div key={fee.pair}>
                  <dt>{fee.pair}</dt>
                  <dd>{fee.bps} bps</dd>
                </div>
              ))}
            </dl>
          )}
          <Link className="k-link" href="/dashboard/plan">
            {paid ? "See your plan" : "Drop the fee"}
          </Link>
        </Card>
      </div>
    </>
  );
}
