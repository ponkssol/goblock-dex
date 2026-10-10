"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { VersionedTransaction } from "@solana/web3.js";
import { useEffect, useRef, useState } from "react";
import type { SwapQuote } from "@/lib/quote";
import { FARTCOIN, SOL, USDC, type TokenInfo, isMint } from "@/lib/tokens";
import { formatAtomic, formatImpact, shorten, toAtomic } from "@/lib/units";
import { PriceChart } from "./price-chart";
import { SiteNav } from "./site-nav";

const SLIPPAGE_PRESETS = [50, 100, 300];
const PRIORITY_FEE_CAP_SOL = "0.0001";
const STABLES = new Set(["EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"]);

function formatPct(bps: number) {
  const pct = bps / 100;
  return Number.isInteger(pct) ? String(pct) : String(Math.round(pct * 100) / 100);
}

type ListedToken = TokenInfo & { name: string; image?: string; verified?: boolean };

const CATALOG: ListedToken[] = [{ ...FARTCOIN, name: "Fartcoin", verified: true }];

export function SwapCard() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, connected } = useWallet();
  const { setVisible } = useWalletModal();
  const [pay, setPay] = useState<TokenInfo>(SOL);
  const [receive, setReceive] = useState<TokenInfo>(USDC);
  const [payAmount, setPayAmount] = useState("0.01");
  const [slippageBps, setSlippageBps] = useState(100);
  const [customSlippage, setCustomSlippage] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chartOpen, setChartOpen] = useState(false);
  const [explorer, setExplorer] = useState<"solscan" | "explorer">("solscan");
  const [brand, setBrand] = useState("");
  const [brandWallet, setBrandWallet] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ListedToken[]>(CATALOG);
  const [listing, setListing] = useState(false);
  const [scope, setScope] = useState<"pump" | "verified">("pump");
  const [factsOpen, setFactsOpen] = useState(true);
  const [order, setOrder] = useState<SwapQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [turned, setTurned] = useState(false);
  const requestId = useRef(0);

  const atomicAmount = toAtomic(payAmount, pay.decimals);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const name = params.get("brand")?.trim() ?? "";
    const wallet = params.get("brandWallet") ?? "";
    if (name) setBrand(name);
    if (isMint(wallet)) setBrandWallet(wallet);
  }, []);

  useEffect(() => {
    const id = ++requestId.current;
    if (!atomicAmount || !isMint(pay.mint) || !isMint(receive.mint)) {
      setOrder(null);
      setQuoting(false);
      return;
    }

    setQuoting(true);
    setError("");
    const timer = setTimeout(async () => {
      const params = new URLSearchParams({
        inputMint: pay.mint,
        outputMint: receive.mint,
        amount: atomicAmount,
        slippageBps: String(slippageBps),
        ...(brandWallet ? { brandWallet } : {}),
      });
      try {
        const response = await fetch(`/api/swap?${params}`);
        const body = (await response.json()) as SwapQuote;
        if (id !== requestId.current) return;
        if (!response.ok || !body.outAmount) {
          setOrder(null);
          setError(body.msg ?? "No pool was found for this pair.");
          return;
        }
        setOrder(body);
      } catch {
        if (id !== requestId.current) return;
        setOrder(null);
        setError("Could not fetch a quote.");
      } finally {
        if (id === requestId.current) setQuoting(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [atomicAmount, pay.mint, receive.mint, slippageBps, brandWallet]);

  useEffect(() => {
    if (!pickerOpen) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setListing(true);
      try {
        const response = await fetch(
          `/api/tokens?q=${encodeURIComponent(query.trim())}&scope=${scope}`,
          { signal: controller.signal },
        );
        const body = (await response.json()) as { tokens?: ListedToken[] };
        if (!Array.isArray(body.tokens)) return;
        setResults(body.tokens);
      } catch {
        // Keep the last list if the request is cancelled or the directory is down.
      } finally {
        if (!controller.signal.aborted) setListing(false);
      }
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [pickerOpen, query, scope]);

  function chooseToken(next: TokenInfo) {
    const token =
      next.mint === FARTCOIN.mint ? { ...FARTCOIN, image: next.image ?? FARTCOIN.image } : next;
    if (pay.mint === SOL.mint) setReceive(token);
    else setPay(token);
    setPickerOpen(false);
    setQuery("");
  }

  function flip() {
    setTurned((value) => !value);
    setPay(receive);
    setReceive(pay);
    setPayAmount("");
    setOrder(null);
    setMessage("");
    setError("");
  }

  async function swap() {
    if (!publicKey || !atomicAmount) return;
    setSwapping(true);
    setError("");
    setMessage("");
    try {
      const params = new URLSearchParams({
        inputMint: pay.mint,
        outputMint: receive.mint,
        amount: atomicAmount,
        slippageBps: String(slippageBps),
        userPublicKey: publicKey.toBase58(),
        ...(brandWallet ? { brandWallet } : {}),
        ...(brand.trim() ? { brand: brand.trim() } : {}),
      });
      const response = await fetch(`/api/swap?${params}`);
      const body = (await response.json()) as SwapQuote;
      if (!response.ok || !body.transaction) {
        throw new Error(body.msg ?? "The transaction is not available.");
      }

      const bytes = Uint8Array.from(atob(body.transaction), (char) => char.charCodeAt(0));
      const transaction = VersionedTransaction.deserialize(bytes);
      const signature = await sendTransaction(transaction, connection);
      setMessage("Transaction sent. Waiting for confirmation…");

      if (body.lastValidBlockHeight) {
        const result = await connection.confirmTransaction(
          {
            signature,
            blockhash: transaction.message.recentBlockhash,
            lastValidBlockHeight: body.lastValidBlockHeight,
          },
          "confirmed",
        );
        if (result.value.err) throw new Error("The transaction failed on the network.");
      }

      setMessage(`Confirmed. ${signature}`);
    } catch (caught) {
      const text = caught instanceof Error ? caught.message : "Swap cancelled.";
      setError(text);
    } finally {
      setSwapping(false);
    }
  }

  const payValue = Number(payAmount);
  const receiveText = order?.outAmount ? formatAtomic(order.outAmount, order.outputMintDecimals) : "0";
  const signature = message.startsWith("Confirmed") ? message.replace("Confirmed. ", "") : "";
  const rate =
    order?.outAmount && payValue > 0
      ? `1 ${pay.symbol} ≈ ${(Number(formatAtomic(order.outAmount, order.outputMintDecimals, 8)) / payValue).toLocaleString("en-US", { maximumFractionDigits: 6 })} ${receive.symbol}`
      : "";
  const impactText = order ? impactLabel(order.priceImpactPct) : "—";
  const networkFeeText = order?.networkFeeLamports
    ? `${formatAtomic(order.networkFeeLamports, 9, 6)} SOL`
    : "—";

  const known = results;
  const pasted =
    isMint(query.trim()) && !known.some((token) => token.mint === query.trim())
      ? { symbol: "TOKEN", name: "Custom token", mint: query.trim(), decimals: 6 }
      : null;

  function openPicker() {
    setQuery("");
    setPickerOpen(true);
  }

  return (
    <main className="stage">
      <SiteNav />

      <div className={chartOpen ? "desk open" : "desk"}>
      <div className="ticket">
      <section className="trade">
        <div className="tools">
          <div className="tool-group">
          <button
            type="button"
            className={settingsOpen ? "icon on" : "icon"}
            aria-label="Swap settings"
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen((open) => !open)}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 4.7 15a1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 8.9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
            </svg>
          </button>
          <button type="button" className="slip" aria-label={`Slippage ${formatPct(slippageBps)} percent`} onClick={() => setSettingsOpen(true)}>
            {formatPct(slippageBps)}%
          </button>
          </div>
          <button
            type="button"
            className={chartOpen ? "icon on" : "icon"}
            aria-label="Price chart"
            aria-expanded={chartOpen}
            onClick={() => setChartOpen((open) => !open)}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path d="M4 19V10M9 19V5M14 19v-6M19 19V8" />
            </svg>
          </button>
        </div>

        {settingsOpen ? (
          <div className="settings">
            <div className="settings-head">
              <h2>Swap settings</h2>
              <button type="button" className="close" onClick={() => setSettingsOpen(false)} aria-label="Close">
                <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>

            <section className="set-block">
              <h3>Slippage tolerance</h3>
              <div className="pills">
                {SLIPPAGE_PRESETS.map((bps) => (
                  <button
                    key={bps}
                    type="button"
                    className={slippageBps === bps && customSlippage === "" ? "on" : undefined}
                    onClick={() => {
                      setCustomSlippage("");
                      setSlippageBps(bps);
                    }}
                  >
                    {formatPct(bps)}%
                  </button>
                ))}
                <label className={customSlippage !== "" || !SLIPPAGE_PRESETS.includes(slippageBps) ? "custom-slip on" : "custom-slip"}>
                  <input
                    inputMode="decimal"
                    aria-label="Custom slippage percent"
                    placeholder="Custom"
                    value={customSlippage}
                    onChange={(event) => {
                      const raw = event.target.value;
                      setCustomSlippage(raw);
                      const value = Number(raw);
                      if (!raw.trim() || !Number.isFinite(value)) return;
                      const bps = Math.round(value * 100);
                      if (bps >= 1 && bps <= 5000) setSlippageBps(bps);
                    }}
                  />
                  <span>%</span>
                </label>
              </div>
              <p>Fails if the price moves past this. Custom is 0.01% to 50%.</p>
            </section>

            <section className="set-block">
              <h3>Priority fee</h3>
              <div className="fee-row">
                <span>Max</span>
                <strong>{PRIORITY_FEE_CAP_SOL} SOL</strong>
              </div>
              <p>Follows the slot queue, up to this cap.</p>
            </section>

            <section className="set-block">
              <h3>Explorer</h3>
              <div className="pills">
                <button type="button" className={explorer === "solscan" ? "on" : undefined} onClick={() => setExplorer("solscan")}>
                  Solscan
                </button>
                <button type="button" className={explorer === "explorer" ? "on" : undefined} onClick={() => setExplorer("explorer")}>
                  Explorer
                </button>
              </div>
              <p>Opens here after the swap confirms.</p>
            </section>
          </div>
        ) : (
        <>
        <div className="pair">
          <div className="panel sell">
            <div className="row">
              <span>Sell</span>
              <TokenChip key={pay.mint} token={pay} onOpen={openPicker} />
            </div>
            <input
              aria-label="Amount to pay"
              inputMode="decimal"
              type="number"
              min="0"
              step="any"
              value={payAmount}
              placeholder="0.0"
              onChange={(event) => setPayAmount(event.target.value)}
            />
            <span className="sub">{rate || " "}</span>
          </div>

          <div className="seam">
            <button className={turned ? "flip turned" : "flip"} type="button" onClick={flip} aria-label="Reverse pair">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path d="M8 7V19M8 7 5 10M8 7l3 3M16 17V5M16 17l-3-3M16 17l3-3" />
              </svg>
            </button>
          </div>

          <div className="panel buy">
            <div className="row">
              <span>Buy</span>
              <TokenChip key={receive.mint} token={receive} onOpen={openPicker} />
            </div>
            <div className="quote" aria-busy={quoting}>
              {quoting ? (
                <span className="quote-load" aria-label="Calculating quote">
                  <span />
                  <span />
                  <span />
                </span>
              ) : (
                receiveText
              )}
            </div>
            <span className="sub">
              {order?.side === "buy" && order.roundTripOutAmount
                ? `Round trip ${formatAtomic(order.roundTripOutAmount, 9)} SOL`
                : order
                  ? formatImpact(order.priceImpactPct)
                  : " "}
            </span>
          </div>
        </div>

        <button
          className="swap"
          type="button"
          disabled={connected && (!order || swapping || quoting)}
          onClick={() => {
            if (!connected) {
              setVisible(true);
              return;
            }
            void swap();
          }}
        >
          {!connected ? "Connect Wallet" : swapping ? "Signing…" : "Swap"}
        </button>

        {order?.receipt ? (
          <ul className="details">
            <li>{order.receipt.venue}</li>
            {order.receipt.graduated ? <li className="ok">Graduated</li> : null}
            {order.receipt.venue === "PumpSwap" || order.receipt.venue === "Bonding curve" ? (
              <li className={order.receipt.creatorFeeBps > 0 ? undefined : "ok"}>
                Creator {(order.receipt.creatorFeeBps / 100).toFixed(2)}%
              </li>
            ) : null}
            {order.receipt.mayhem ? <li>Mayhem</li> : null}
            {order.receipt.cashback ? <li className="ok">Cashback</li> : null}
            <li className={order.feeBps ? undefined : "ok"}>
              {order.feeBps ? `Link fee ${(order.feeBps / 100).toFixed(2)}%` : "No fee"}
            </li>
          </ul>
        ) : null}

        <label className="memo">
          <input
            aria-label="Brand name"
            maxLength={32}
            placeholder={brandWallet ? "Brand on this link" : "Memo, no fee"}
            value={brand}
            onChange={(event) => setBrand(event.target.value)}
          />
        </label>

        {error || signature || message ? (
          <p className={error ? "status error" : "status"}>
            {error ? (
              error
            ) : signature ? (
              <a
                href={
                  explorer === "solscan"
                    ? `https://solscan.io/tx/${signature}`
                    : `https://explorer.solana.com/tx/${signature}`
                }
                target="_blank"
                rel="noreferrer"
              >
                View transaction {shorten(signature, 6, 6)}
              </a>
            ) : (
              message
            )}
          </p>
        ) : null}
        </>
        )}
      </section>

      <section className="facts" aria-label="Quote details">
        <button
          className="facts-rate"
          type="button"
          aria-expanded={factsOpen}
          onClick={() => setFactsOpen((open) => !open)}
        >
          <span>Rate</span>
          <strong>{rate || "—"}</strong>
          {order ? (
            <span className="route">
              <img src="/goblock-logo.png" alt="goblock" />
            </span>
          ) : null}
          <svg className={factsOpen ? "chev open" : "chev"} viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M6 14.5 12 8.5l6 6" />
          </svg>
        </button>
        {factsOpen ? (
          <dl>
            <div>
              <dt>Price Impact</dt>
              <dd>{impactText}</dd>
            </div>
            <div>
              <dt>Solana Network Fee</dt>
              <dd>{networkFeeText}</dd>
            </div>
          </dl>
        ) : null}
      </section>
      </div>
      <aside className="chart-slot" inert={!chartOpen ? true : undefined} aria-label="Price chart">
        <PriceChart
          mint={(STABLES.has(receive.mint) ? pay : receive).mint}
          symbol={(STABLES.has(receive.mint) ? pay : receive).symbol}
          active={chartOpen}
        />
      </aside>
      </div>

      {pickerOpen ? (
        <div className="shade" onClick={() => setPickerOpen(false)}>
          <div
            className="picker"
            role="dialog"
            aria-modal="true"
            aria-label="Select a token"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="picker-head">
              <h2>Select a token</h2>
              <button type="button" className="close" onClick={() => setPickerOpen(false)} aria-label="Close">
                <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            <div className="scopes" role="tablist" aria-label="Token list">
              <button type="button" className={scope === "pump" ? "on" : undefined} onClick={() => setScope("pump")}>
                Pump
              </button>
              <button
                type="button"
                className={scope === "verified" ? "on" : undefined}
                onClick={() => setScope("verified")}
              >
                Verified
              </button>
            </div>
            <label className="finder">
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <circle cx="11" cy="11" r="6" />
                <path d="m16 16 4 4" />
              </svg>
              <input
                aria-label="Search tokens by name, symbol, or address"
                placeholder="Search tokens by name, symbol, or address"
                spellCheck={false}
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <ul className="token-list">
              {known.map((token) => (
                <li key={token.mint}>
                  <button type="button" onClick={() => chooseToken(token)}>
                    <TokenMark token={token} />
                    <span>
                      <strong>
                        {token.symbol}
                        {token.verified ? <Verified /> : null}
                      </strong>
                      <small>
                        {token.name} <em>{shorten(token.mint, 4, 4)}</em>
                      </small>
                    </span>
                  </button>
                </li>
              ))}
              {pasted ? (
                <li>
                  <button type="button" onClick={() => chooseToken(pasted)}>
                    <span className="mark alt lg" aria-hidden="true" />
                    <span>
                      <strong>Custom token</strong>
                      <small>
                        Pasted address <em>{shorten(pasted.mint, 4, 4)}</em>
                      </small>
                    </span>
                  </button>
                </li>
              ) : null}
              {listing && !known.length ? <li className="empty">Loading tokens…</li> : null}
              {!listing && !known.length && !pasted ? <li className="empty">No token matches that search.</li> : null}
            </ul>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function impactLabel(priceImpactPct: string): string {
  const percent = Number(priceImpactPct) * 100;
  if (!Number.isFinite(percent)) return "—";
  if (Math.abs(percent) < 0.0005) return "0%";
  return formatImpact(priceImpactPct);
}

function TokenChip({ token, onOpen }: { token: TokenInfo; onOpen: () => void }) {
  const [failed, setFailed] = useState(false);
  const editable = token.mint !== SOL.mint;
  return (
    <button
      className="token"
      type="button"
      onClick={() => {
        if (editable) onOpen();
      }}
    >
      {token.image && !failed ? (
        <img className="mark" src={token.image} alt="" onError={() => setFailed(true)} />
      ) : (
        <span className={token.mint === SOL.mint ? "mark sol" : "mark alt"} aria-hidden="true" />
      )}
      {token.symbol}
      <span className="caret" aria-hidden="true" />
    </button>
  );
}

function TokenMark({ token }: { token: ListedToken }) {
  const sources = imageSources(token);
  const [index, setIndex] = useState(0);
  const src = sources[index];
  if (src) {
    return (
      <img className="logo" src={src} alt="" onError={() => setIndex((current) => current + 1)} />
    );
  }
  return <span className={token.mint === SOL.mint ? "mark sol lg" : "mark alt lg"} aria-hidden="true" />;
}

function imageSources(token: ListedToken): string[] {
  const sources = token.mint.endsWith("pump") ? [`https://images.pump.fun/coin-image/${token.mint}`] : [];
  if (token.image && !sources.includes(token.image)) sources.push(token.image);
  return sources;
}

function Verified() {
  return (
    <svg className="verified" viewBox="0 0 16 16" width="14" height="14" aria-label="Verified">
      <circle cx="8" cy="8" r="7" />
      <path d="M4.6 8.1 7 10.4 11.4 5.6" />
    </svg>
  );
}
