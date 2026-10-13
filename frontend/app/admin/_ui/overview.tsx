"use client";

import Link from "next/link";
import { ago, count, planName } from "../../dashboard/_ui/format";
import { Card, Kpi, PageHead } from "../../dashboard/_ui/shell";
import { shorten } from "@/lib/units";
import { Loading, money, useAdmin, type Overview } from "./data";

export function AdminOverview() {
  const { data, error } = useAdmin<Overview>("overview");
  if (!data) return <Loading error={error} />;

  return (
    <>
      <PageHead title="Overview" sub="Keys, checkout payments, discount codes, and the public waitlist." />
      <ul className="ds-kpis">
        <Kpi label="Active keys" value={count(data.activeKeys)} foot={`${count(data.keys)} issued`} icon="keys" />
        <Kpi label="Payments" value={count(data.payments)} foot="Checkout settlements" icon="earnings" />
        <Kpi label="Waitlist" value={count(data.waiting)} foot="People on the list" icon="users" />
        <Kpi label="Requests today" value={count(data.requestsToday)} foot={`${count(data.codes)} live codes`} icon="usage" lime />
      </ul>
      <div className="ds-grid c-1-1">
        <Card plain title="Latest payments" sub="Newest checkout first" action={<Link href="/admin/payments">All payments</Link>}>
          {data.recentPayments.length ? (
            <ul className="ds-vouchers">
              {data.recentPayments.map((row) => (
                <li key={row.signature}>
                  <b>{planName(row.plan)}</b>
                  <span>{money(row.asset, row.amount)}</span>
                  <span>{shorten(row.wallet, 4, 4)}</span>
                  <em>{ago(row.createdAt)}</em>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ds-fine">No payments yet.</p>
          )}
        </Card>
        <Card plain title="Latest signups" sub="Public waitlist" action={<Link href="/admin/waitlist">Open waitlist</Link>}>
          {data.recentWaitlist.length ? (
            <ul className="ds-vouchers">
              {data.recentWaitlist.map((row) => (
                <li key={row.id}>
                  <b>{row.email}</b>
                  <span>{row.wallet ? shorten(row.wallet, 4, 4) : "No wallet"}</span>
                  <em>{ago(row.createdAt)}</em>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ds-fine">No one has joined yet.</p>
          )}
        </Card>
      </div>
    </>
  );
}
