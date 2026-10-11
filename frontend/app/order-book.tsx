"use client";

import { useEffect, useState } from "react";
import { SOL, type TokenInfo } from "@/lib/tokens";

const QUOTES = new Set([
  SOL.mint,
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  "USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB",
]);

type Print = {
  id: string;
  seq?: string;
  price: number;
  amount: number;
  sol?: number;
  usd: number;
  side: "buy" | "sell";
  time: number;
};

export function OrderBook({ active, pay, receive }: { active: boolean; pay: TokenInfo; receive: TokenInfo }) {
  const token = bookToken(pay, receive);
  const [rows, setRows] = useState<Print[]>([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!active) return;
    let alive = true;
    setRows([]);
    setMsg("");
    const load = async (quiet: boolean) => {
      if (!quiet) setLoading(true);
      try {
        const response = await fetch(`/api/book?mint=${token.mint}`);
        const body = (await response.json()) as { rows?: Print[]; msg?: string };
        if (!alive) return;
        const next = Array.isArray(body.rows) ? body.rows : [];
        setRows(
          next
            .filter((row) => row.id)
            .sort((a, b) => ((a.seq ?? "") < (b.seq ?? "") ? 1 : (a.seq ?? "") > (b.seq ?? "") ? -1 : b.time - a.time))
            .slice(0, 14),
        );
        setMsg(body.msg ?? "");
      } catch {
        if (!alive) return;
        setRows([]);
        setMsg("Trades could not be loaded.");
      } finally {
        if (alive) setLoading(false);
      }
    };
    void load(false);
    const timer = window.setInterval(() => void load(true), 4_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [active, token.mint]);

  const quoteOnly = token.mint === SOL.mint || token.symbol === "USDC";

  return (
    <div className={quoteOnly ? "chart-card book-card" : "chart-card book-card asset"}>
      <header className="chart-head">
        <strong>
          Trades
          <span> {token.symbol}</span>
        </strong>
        <em>
          <i />
          Live
        </em>
      </header>
      <div className="book-cols" aria-hidden="true">
        <span>Time</span>
        <span>Side</span>
        <span>Price</span>
        {quoteOnly ? null : <span>{token.symbol}</span>}
        <span>SOL</span>
        <span>USDC</span>
      </div>
      <div className="book-table" aria-label={`${token.symbol} transactions`}>
        {rows.map((row, index) => (
          <div key={`${row.id}:${row.seq ?? row.side}:${index}`} className={row.side === "sell" ? "book-row sell" : "book-row buy"}>
            <span>{formatTime(row.time)}</span>
            <span>{row.side === "buy" ? "Buy" : "Sell"}</span>
            <span>{formatPrice(row.price)}</span>
            {quoteOnly ? null : <span>{formatSize(row.amount)}</span>}
            <span>{formatSize(token.mint === SOL.mint ? row.amount : row.sol || 0)}</span>
            <span>{formatSize(token.symbol === "USDC" ? row.amount : row.usd)}</span>
          </div>
        ))}
        {loading && !rows.length ? <p className="plot-note">Loading trades</p> : null}
        {!loading && !rows.length ? <p className="plot-note">{msg || "No recent trades for this token."}</p> : null}
      </div>
    </div>
  );
}

function bookToken(pay: TokenInfo, receive: TokenInfo) {
  if (!QUOTES.has(receive.mint)) return receive;
  if (!QUOTES.has(pay.mint)) return pay;
  return pay.mint === SOL.mint ? pay : receive;
}

function formatTime(time: number) {
  return new Date(time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatPrice(value: number) {
  if (value >= 1000) return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (value >= 1) return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  if (value >= 0.01) return value.toLocaleString("en-US", { maximumFractionDigits: 5 });
  return value.toLocaleString("en-US", { maximumFractionDigits: 8 });
}

function formatSize(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "—";
  if (value >= 1000) return value.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 2 });
  if (value >= 1) return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (value >= 0.01) return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return value.toLocaleString("en-US", { maximumFractionDigits: 6 });
}
