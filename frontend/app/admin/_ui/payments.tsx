"use client";

import { ago, planName } from "../../dashboard/_ui/format";
import { solscan } from "../../dashboard/_ui/format";
import { Card, PageHead } from "../../dashboard/_ui/shell";
import { shorten } from "@/lib/units";
import { Loading, money, useAdmin, type PayRow } from "./data";

export function PaymentsView() {
  const { data, error } = useAdmin<{ payments: PayRow[] }>("payments");
  if (!data) return <Loading error={error} />;

  return (
    <>
      <PageHead title="Payments" sub="Each row is a checkout that already landed and issued a key." />
      <Card plain title="Settlements" sub="SOL and USDC sent to the subscription wallet.">
        {data.payments.length ? (
          <ul className="ds-vouchers">
            {data.payments.map((row) => (
              <li key={row.signature}>
                <b>{planName(row.plan)}</b>
                <span>{money(row.asset, row.amount)}</span>
                <span>{shorten(row.wallet, 4, 4)}</span>
                <span>{ago(row.createdAt)}</span>
                <a href={solscan(`tx/${row.signature}`)} target="_blank" rel="noreferrer">
                  {shorten(row.signature, 4, 4)}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ds-fine">No payments yet.</p>
        )}
      </Card>
    </>
  );
}
