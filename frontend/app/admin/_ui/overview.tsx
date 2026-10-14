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
      <PageHead title="Overview" sub="Keys, checkout payments, and discount codes." />
      <ul className="ds-kpis three">
        <Kpi label="Active keys" value={count(data.activeKeys)} foot={`${count(data.keys)} issued`} icon="keys" />
        <Kpi label="Payments" value={count(data.payments)} foot="Checkout settlements" icon="earnings" />
        <Kpi label="Requests today" value={count(data.requestsToday)} foot={`${count(data.codes)} live codes`} icon="usage" lime />
      </ul>
      <div className="ds-grid">
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
      </div>
    </>
  );
}
