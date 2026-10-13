"use client";

import { shorten } from "@/lib/units";
import { CodeBlock } from "../../code-block";
import { SOL } from "../../docs/parts";
import { ago, count, sol, solscan } from "./format";
import { Icon } from "./icons";
import { Card, Kpi, PageHead, useEarnings, useLoaded } from "./shell";

const PUMP_TOKEN = "YOUR_TOKEN_MINT";

export function EarningsView() {
  const { overview, placeholder } = useLoaded();
  const { earnings, earningsBusy, earningsError, loadEarnings } = useEarnings();
  if (!overview) return placeholder;

  const total = earnings?.reduce((sum, row) => sum + row.lamports, 0) ?? 0;
  const swaps = earnings?.reduce((sum, row) => sum + row.swaps, 0) ?? 0;
  const { minBps, maxBps } = overview.platformFee;
  const paid = overview.plan === "paid";

  return (
    <>
      <PageHead title="Earnings" sub="SOL your fee wallets received from goblock swaps, read straight from Solana.">
        <button className="p-btn line" type="button" disabled={earningsBusy} onClick={() => void loadEarnings()}>
          <Icon name="refresh" size={16} />
          {earningsBusy ? "Reading…" : "Refresh"}
        </button>
      </PageHead>

      <ul className="ds-kpis three">
        <Kpi lime icon="earnings" label="Received" value={earnings ? `${sol(total)} SOL` : "…"} foot="Across all fee wallets" />
        <Kpi icon="check" label="Swaps that paid" value={earnings ? count(swaps) : "…"} foot="Landed goblock swaps" />
        <Kpi icon="keys" label="Fee wallets" value={`${overview.feeWallets.length} / 5`} foot="Seen on your keys" />
      </ul>

      <div className="ds-grid c-2-1">
        <Card title="Fee wallets" sub="Latest 50 transactions per wallet">
          {earningsError ? <p className="b-error">{earningsError}</p> : null}
          {earnings && earnings.length ? (
            <table className="ds-table">
              <thead>
                <tr>
                  <th>Wallet</th>
                  <th className="ds-opt">Last swap</th>
                  <th className="num">Swaps</th>
                  <th className="num">Received</th>
                </tr>
              </thead>
              <tbody>
                {earnings.map((row) => (
                  <tr key={row.wallet}>
                    <td>
                      <a href={solscan(`account/${row.wallet}`)} target="_blank" rel="noreferrer">
                        {shorten(row.wallet, 6, 6)}
                      </a>
                    </td>
                    <td className="ds-opt">{row.lastAt ? ago(row.lastAt) : "—"}</td>
                    <td className="num">{count(row.swaps)}</td>
                    <td className="num">
                      <b>{sol(row.lamports)} SOL</b>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : earnings ? (
            <div className="ds-empty">
              <Icon name="earnings" size={22} />
              <b>No fee wallets yet</b>
              <p>Send platformFeeBps and feeWallet with a swap call. The wallet shows up here after the first quote.</p>
            </div>
          ) : (
            <div className="ds-loading slim">
              <i />
            </div>
          )}
        </Card>

        <Card plain title="How it pays">
          <ul className="ds-tips">
            <li>
              <Icon name="earnings" size={18} />
              <div>
                <b>
                  {minBps} to {maxBps} bps
                </b>
                <p>Set platformFeeBps on each call. The fee is taken in SOL on the SOL side of the swap.</p>
              </div>
            </li>
            <li>
              <Icon name="shield" size={18} />
              <div>
                <b>{paid ? "You keep 90%" : "goblock keeps 10% or the key fee"}</b>
                <p>
                  {paid
                    ? "On a monthly plan, 90% of your fee goes to your wallet."
                    : "On a free key, goblock keeps 10% or the free-key fee for that pair, whichever is larger."}
                </p>
              </div>
            </li>
            <li>
              <Icon name="check" size={18} />
              <div>
                <b>Paid only when it lands</b>
                <p>The router program pays the fee inside the swap, so a failed swap pays nothing.</p>
              </div>
            </li>
          </ul>
        </Card>
      </div>

      <Card plain title="Add your fee" sub="Any quote with a transaction can carry it">
        <CodeBlock
          className="slim"
          snippets={[
            {
              label: "cURL",
              code: `curl -G "{origin}/api/v1/swap" \\
  -H "x-api-key: $GOBLOCK_API_KEY" \\
  -d inputMint=${SOL} \\
  -d outputMint=${PUMP_TOKEN} \\
  -d amount=100000000 \\
  -d userPublicKey=$USER_WALLET \\
  -d platformFeeBps=100 \\
  -d feeWallet=$YOUR_FEE_WALLET`,
            },
          ]}
        />
      </Card>
    </>
  );
}
