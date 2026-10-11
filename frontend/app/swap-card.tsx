"use client";

import { PublicKey, VersionedTransaction, type Connection } from "@solana/web3.js";
import { useGoblockWallet } from "./wallet";
import { watchSignature } from "./solana";
import { useEffect, useRef, useState } from "react";
import type { SwapQuote } from "@/lib/quote";
import { FARTCOIN, SOL, USDC, type TokenInfo, isMint } from "@/lib/tokens";
import { formatAtomic, formatImpact, shorten, toAtomic } from "@/lib/units";
import dynamic from "next/dynamic";
import { SiteNav } from "./site-nav";
import { WalletBridge } from "./wallet-bridge";

const PairChart = dynamic(() => import("./pair-chart").then((module) => module.PairChart), { ssr: false });
const OrderBook = dynamic(() => import("./order-book").then((module) => module.OrderBook), { ssr: false });

const SLIPPAGE_CHOICES = [30, 50];
const AUTO_SLIPPAGE_BPS = 100;
const FEE_LAMPORT_CAP = 10_000_000;

function formatPct(bps: number) {
  const pct = bps / 100;
  return Number.isInteger(pct) ? String(pct) : String(Math.round(pct * 100) / 100);
}

function priorityParams(mode: "max" | "exact", text: string): Record<string, string> {
  const sol = Number(text);
  if (!Number.isFinite(sol) || sol <= 0) return {};
  const lamports = Math.round(sol * 1_000_000_000);
  if (lamports < 1 || lamports > FEE_LAMPORT_CAP) return {};
  return { priorityMode: mode, priorityLamports: String(lamports) };
}

function feeEstimate(text: string, solUsd: number | null) {
  const sol = Number(text);
  if (!Number.isFinite(sol) || sol <= 0 || solUsd === null || solUsd <= 0) return "";
  const usd = sol * solUsd;
  return usd < 0.01 ? `≈ $${usd.toFixed(4)}` : `≈ $${usd.toFixed(2)}`;
}

function formatUsd(value: number) {
  if (!Number.isFinite(value) || value <= 0) return " ";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function usdFromAtomic(amount: string, decimals: number, price: number | null) {
  const units = Number(amount) / 10 ** decimals;
  if (!Number.isFinite(units) || price === null || price <= 0) return " ";
  return formatUsd(units * price);
}

function receiveValueUsd(order: SwapQuote | null, solUsd: number | null, pay: TokenInfo, receive: TokenInfo) {
  if (!order) return " ";
  if (order.side === "buy") return usdFromAtomic(order.roundTripOutAmount || order.inAmount, 9, solUsd);
  if (receive.mint === SOL.mint) return usdFromAtomic(order.outAmount, order.outputMintDecimals, solUsd);
  if (receive.mint === USDC.mint) return usdFromAtomic(order.outAmount, order.outputMintDecimals, 1);
  if (pay.mint === USDC.mint) return usdFromAtomic(order.inAmount, order.inputMintDecimals, 1);
  if (pay.mint === SOL.mint) return usdFromAtomic(order.inAmount, 9, solUsd);
  return " ";
}

function formatTokenAmount(value: number, decimals: number): string {
  if (!Number.isFinite(value) || value <= 0) return "";
  const places = Math.min(Math.max(decimals, 0), 6);
  return value.toFixed(places).replace(/\.?0+$/, "");
}

function trimUsd(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "";
  const places = value >= 1 ? 2 : value >= 0.01 ? 4 : 6;
  return value.toFixed(places).replace(/\.?0+$/, "");
}

const SOL_FEE_RESERVE = 5_000_000n;

type ListedToken = TokenInfo & {
  name: string;
  image?: string;
  verified?: boolean;
  marketCap?: number;
  createdAt?: number;
};
type Holding = ListedToken & { amount: string };
type PickerSide = "pay" | "receive";

const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const TOKEN_2022 = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

const PAIRS: ListedToken[] = [
  { ...SOL, name: "Solana", verified: true },
  { ...USDC, name: "USD Coin", verified: true },
  {
    symbol: "USD1",
    name: "USD1",
    mint: "USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB",
    decimals: 6,
    image: "https://raw.githubusercontent.com/worldliberty/usd1-metadata/refs/heads/main/logo.png",
    verified: true,
  },
  {
    symbol: "USDT",
    name: "USDT",
    mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    decimals: 6,
    image:
      "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg",
    verified: true,
  },
];
const tokenLists = new Map<string, ListedToken[]>();

function listKey(scope: "pump" | "equities", query: string) {
  return `${scope}:${query.trim().toLowerCase()}`;
}

async function loadTokenList(scope: "pump" | "equities", query: string, signal?: AbortSignal) {
  const response = await fetch(`/api/tokens?q=${encodeURIComponent(query.trim())}&scope=${scope}`, { signal });
  const body = (await response.json()) as { tokens?: ListedToken[] };
  if (!Array.isArray(body.tokens)) return [];
  if (body.tokens.length || !isMint(query.trim())) tokenLists.set(listKey(scope, query), body.tokens);
  return body.tokens;
}

function withPastedMint(scope: "pump" | "equities", query: string, tokens: ListedToken[]) {
  const mint = query.trim();
  if (scope !== "pump" || !isMint(mint)) return tokens;
  const spot = tokenLists.get(listKey("pump", "")) ?? [];
  const match = tokens.find((token) => token.mint === mint);
  if (!spot.length) return tokens;
  const rest = spot.filter((token) => token.mint !== mint);
  return match ? [match, ...rest].slice(0, 40) : rest;
}

export function SwapCard() {
  const { connection, publicKey, sendTransaction, connected, openWallet } = useGoblockWallet();
  const [pay, setPay] = useState<TokenInfo>(SOL);
  const [receive, setReceive] = useState<TokenInfo>(USDC);
  const [payAmount, setPayAmount] = useState("0.01");
  const [slippageBps, setSlippageBps] = useState(AUTO_SLIPPAGE_BPS);
  const [slippageMode, setSlippageMode] = useState<"auto" | "set">("auto");
  const [customSlippage, setCustomSlippage] = useState("");
  const [feeMode, setFeeMode] = useState<"max" | "exact">("max");
  const [feeText, setFeeText] = useState("0.0001");
  const [panel, setPanel] = useState<"chart" | "memo" | "book" | "settings" | null>(null);
  const [shown, setShown] = useState<"chart" | "memo" | "book" | "settings" | null>(null);

  useEffect(() => {
    if (panel) {
      setShown(panel);
      return;
    }
    const timer = window.setTimeout(() => setShown(null), 700);
    return () => window.clearTimeout(timer);
  }, [panel]);
  const [explorer, setExplorer] = useState<"solscan" | "explorer">("solscan");
  const [brand, setBrand] = useState("");
  const [brandWallet, setBrandWallet] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSide, setPickerSide] = useState<PickerSide>("receive");
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ListedToken[]>([]);
  const [listing, setListing] = useState(false);
  const [market, setMarket] = useState<"spot" | "equities">("spot");
  const [factsOpen, setFactsOpen] = useState(false);
  const [order, setOrder] = useState<SwapQuote | null>(null);
  const [solUsd, setSolUsd] = useState<number | null>(null);
  const [payUsd, setPayUsd] = useState<number | null>(null);
  const [usdOn, setUsdOn] = useState(false);
  const [usdText, setUsdText] = useState("");
  const [payBalance, setPayBalance] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [sellNote, setSellNote] = useState("");
  const [buyNote, setBuyNote] = useState("");
  const [shownOut, setShownOut] = useState("0");
  const [swapping, setSwapping] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ ok: boolean; signature: string; detail: string } | null>(null);
  const [awaiting, setAwaiting] = useState(false);
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

  const swappingRef = useRef(swapping);
  swappingRef.current = swapping;

  useEffect(() => {
    const id = ++requestId.current;
    if (!atomicAmount || !isMint(pay.mint) || !isMint(receive.mint)) {
      setOrder(null);
      setQuoting(false);
      return;
    }

    let alive = true;
    let seq = 0;
    const load = async (quiet: boolean) => {
      if (quiet && swappingRef.current) return;
      const ticket = ++seq;
      if (!quiet) {
        setQuoting(true);
        setError("");
      }
      const params = new URLSearchParams({
        inputMint: pay.mint,
        outputMint: receive.mint,
        amount: atomicAmount,
        slippageBps: String(slippageBps),
        ...priorityParams(feeMode, feeText),
        ...(brandWallet ? { brandWallet } : {}),
      });
      try {
        const response = await fetch(`/api/swap?${params}`);
        const body = (await response.json()) as SwapQuote;
        if (!alive || id !== requestId.current || ticket !== seq) return;
        if (!response.ok || !body.outAmount) {
          if (!quiet) {
            setOrder(null);
            setError(body.msg ?? "No pool was found for this pair.");
          }
          return;
        }
        setOrder(body);
      } catch {
        if (!alive || id !== requestId.current || ticket !== seq) return;
        if (!quiet) {
          setOrder(null);
          setError("Could not fetch a quote.");
        }
      } finally {
        if (alive && id === requestId.current && ticket === seq && !quiet) setQuoting(false);
      }
    };

    const timer = setTimeout(() => load(false), 400);
    const poll = setInterval(() => load(true), 8_000);
    return () => {
      alive = false;
      clearTimeout(timer);
      clearInterval(poll);
    };
  }, [atomicAmount, pay.mint, receive.mint, slippageBps, brandWallet, feeMode, feeText]);

  useEffect(() => {
    let alive = true;
    const load = () => {
      fetch(`/api/price?mint=${SOL.mint}`)
        .then((response) => response.json() as Promise<{ usd?: number }>)
        .then((body) => {
          if (alive && typeof body.usd === "number" && Number.isFinite(body.usd) && body.usd > 0) setSolUsd(body.usd);
        })
        .catch(() => {});
    };
    load();
    const timer = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (pay.mint === USDC.mint) {
      setPayUsd(1);
      return;
    }
    if (pay.mint === SOL.mint) {
      setPayUsd(solUsd);
      return;
    }
    let alive = true;
    setPayUsd(null);
    fetch(`/api/price?mint=${pay.mint}`)
      .then((response) => response.json() as Promise<{ usd?: number }>)
      .then((body) => {
        if (alive && typeof body.usd === "number" && Number.isFinite(body.usd) && body.usd > 0) setPayUsd(body.usd);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [pay.mint, solUsd]);

  useEffect(() => {
    if (!usdOn || payUsd === null || payUsd <= 0) return;
    const usd = Number(usdText);
    if (!usdText.trim() || !Number.isFinite(usd) || usd < 0) {
      if (!usdText.trim()) setPayAmount("");
      return;
    }
    setPayAmount(formatTokenAmount(usd / payUsd, pay.decimals));
  }, [usdOn, usdText, payUsd, pay.decimals]);

  useEffect(() => {
    if (!publicKey) {
      setPayBalance(null);
      return;
    }
    const owner = publicKey;
    let alive = true;
    void (async () => {
      try {
        if (pay.mint === SOL.mint) {
          const lamports = await connection.getBalance(owner, "confirmed");
          if (alive) setPayBalance(String(lamports));
          return;
        }
        const rows = await loadHoldings(connection, owner);
        if (alive) setPayBalance(rows.find((row) => row.mint === pay.mint)?.amount ?? "0");
      } catch {
        if (alive) setPayBalance(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [publicKey, pay.mint, connection, swapping]);

  const listScope = market === "equities" ? "equities" : "pump";

  const queryRef = useRef(query);
  queryRef.current = query;

  useEffect(() => {
    void loadTokenList("pump", "").then((tokens) => {
      if (!tokens.length) return;
      setResults((current) => {
        const mint = queryRef.current.trim();
        if (!isMint(mint)) return mint ? current : tokens;
        const match = current.find((token) => token.mint === mint);
        const rest = tokens.filter((token) => token.mint !== mint);
        return match ? [match, ...rest].slice(0, 40) : current.length ? current : tokens;
      });
    });
    void loadTokenList("equities", "");
  }, []);

  useEffect(() => {
    if (!pickerOpen) return;
    const cached = tokenLists.get(listKey(listScope, query));
    if (cached?.length) setResults(withPastedMint(listScope, query, cached));
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      if (!cached?.length) setListing(true);
      try {
        const tokens = await loadTokenList(listScope, query, controller.signal);
        setResults(withPastedMint(listScope, query, tokens));
      } catch {
        // Keep the last list if the request is cancelled or the directory is down.
      } finally {
        if (!controller.signal.aborted) setListing(false);
      }
    }, query.trim() ? 180 : 0);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [pickerOpen, query, listScope]);

  useEffect(() => {
    if (!pickerOpen || pickerSide !== "pay" || !publicKey) {
      setHoldings([]);
      return;
    }
    const owner = publicKey;
    let alive = true;
    setListing(true);
    void loadHoldings(connection, owner)
      .then((rows) => {
        if (alive) setHoldings(rows);
      })
      .catch(() => {
        if (alive) setHoldings([]);
      })
      .finally(() => {
        if (alive) setListing(false);
      });
    return () => {
      alive = false;
    };
  }, [pickerOpen, pickerSide, publicKey, connection]);

  function chooseToken(next: TokenInfo) {
    const token =
      next.mint === FARTCOIN.mint ? { ...FARTCOIN, image: next.image ?? FARTCOIN.image } : next;
    if (pickerSide === "pay") {
      if (token.mint === receive.mint) setReceive(pay);
      if (token.mint !== pay.mint) {
        setPayAmount("");
        setUsdText("");
      }
      setPay(token);
    } else if (token.mint === pay.mint) {
      setPay(receive);
      setReceive(token);
      setPayAmount("");
    } else {
      setReceive(token);
    }
    setPickerOpen(false);
    setQuery("");
  }

  function plainSwapError(caught: unknown) {
    const raw = caught instanceof Error ? caught.message : "The swap could not be sent.";
    const lower = raw.toLowerCase();
    if (lower.includes("user rejected") || lower.includes("rejected the request") || lower.includes("user denied")) {
      return "The wallet rejected the swap.";
    }
    if (lower.includes("blockhash") || lower.includes("block height exceeded")) {
      return "The quote expired. Try the swap again.";
    }
    if (lower.includes("insufficient")) return "The wallet does not have enough SOL for this swap.";
    const lines = raw
      .split(/\r?\n|",\s*"/)
      .map((line) => line.replace(/^[\s[\]"]+|[\s[\]"]+$/g, "").trim())
      .filter(Boolean);
    const reason = [...lines].reverse().find(
      (line) =>
        /error|failed|insufficient|slippage|exceeded|custom program/i.test(line) &&
        !/consumed \d+ of \d+ compute units/i.test(line) &&
        !/invoke \[/i.test(line) &&
        !/^program data:/i.test(line),
    );
    if (reason && reason.length < 160 && !/^program [1-9A-HJ-NP-Za-km-z]{20,}/i.test(reason)) return reason;
    if (raw.length > 160 || /consumed \d+ of \d+ compute units/i.test(raw)) {
      return "The swap could not be simulated. Try again.";
    }
    return raw;
  }

  function flip() {
    setTurned((value) => !value);
    setPay(receive);
    setReceive(pay);
    setPayAmount("");
    setUsdText("");
    setOrder(null);
    setMessage("");
    setError("");
  }

  async function swap() {
    if (!publicKey || !atomicAmount) return;
    setSwapping(true);
    setAwaiting(false);
    setError("");
    setMessage("");
    setResult(null);
    let signature = "";
    try {
      const params = new URLSearchParams({
        inputMint: pay.mint,
        outputMint: receive.mint,
        amount: atomicAmount,
        slippageBps: String(slippageBps),
        ...priorityParams(feeMode, feeText),
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
      const sent = await sendTransaction(transaction);
      signature = sent;
      setAwaiting(true);
      if (body.lastValidBlockHeight) {
        const outcome = await watchSignature(sent, body.lastValidBlockHeight).catch(() => "expired" as const);
        if (outcome === "failed") {
          setResult({ ok: false, signature: sent, detail: "The transaction failed on the network." });
          return;
        }
        if (outcome === "expired") {
          setResult({ ok: false, signature: sent, detail: "The transaction expired before it confirmed." });
          return;
        }
      }
      setResult({ ok: true, signature: sent, detail: "" });
    } catch (caught) {
      setResult({ ok: false, signature, detail: plainSwapError(caught) });
    } finally {
      setSwapping(false);
      setAwaiting(false);
    }
  }

  const payValue = Number(payAmount);
  const resultHref = result?.signature ? `https://solscan.io/tx/${result.signature}` : "";
  const rate =
    order?.outAmount && payValue > 0
      ? `1 ${pay.symbol} ≈ ${(Number(formatAtomic(order.outAmount, order.outputMintDecimals, 8)) / payValue).toLocaleString("en-US", { maximumFractionDigits: 6 })} ${receive.symbol}`
      : "";
  const sellCaption = usdOn
    ? payAmount && Number(payAmount) > 0
      ? `≈ ${Number(payAmount).toLocaleString("en-US", { maximumFractionDigits: 6 })} ${pay.symbol}`
      : ""
    : rate;
  const buyCaption = receiveValueUsd(order, solUsd, pay, receive);
  const impactText = order ? impactLabel(order.priceImpactPct) : "—";
  const networkFeeText = order?.networkFeeLamports
    ? `${formatAtomic(order.networkFeeLamports, 9, 6)} SOL`
    : "—";

  useEffect(() => {
    if (sellCaption.trim()) setSellNote(sellCaption);
  }, [sellCaption]);

  useEffect(() => {
    if (buyCaption.trim()) setBuyNote(buyCaption);
  }, [buyCaption]);

  useEffect(() => {
    if (order?.outAmount) setShownOut(formatAtomic(order.outAmount, order.outputMintDecimals));
  }, [order]);

  const needle = query.trim().toLowerCase();
  const walletRows = holdings.filter((token) => {
    if (!needle) return true;
    return (
      token.symbol.toLowerCase().includes(needle) ||
      token.name.toLowerCase().includes(needle) ||
      token.mint.toLowerCase().startsWith(needle)
    );
  });
  const known = pickerSide === "pay" && market === "spot" ? walletRows : results;
  const pasted =
    pickerSide === "receive" && isMint(query.trim()) && !known.some((token) => token.mint === query.trim())
      ? { symbol: "TOKEN", name: "Custom token", mint: query.trim(), decimals: 6 }
      : null;

  function toggleUsd() {
    if (!usdOn) {
      const tokens = Number(payAmount);
      setUsdText(payUsd && payUsd > 0 && Number.isFinite(tokens) && tokens > 0 ? trimUsd(tokens * payUsd) : "");
    }
    setUsdOn((on) => !on);
  }

  function applyShare(percent: number) {
    if (!publicKey) {
      openWallet();
      return;
    }
    if (payBalance === null) return;
    const balance = BigInt(payBalance);
    const next =
      percent >= 100 && pay.mint === SOL.mint
        ? balance > SOL_FEE_RESERVE
          ? balance - SOL_FEE_RESERVE
          : 0n
        : (balance * BigInt(percent)) / 100n;
    const text = next <= 0n ? "0" : formatAtomic(next.toString(), pay.decimals, 6);
    if (usdOn) {
      const tokens = Number(text);
      setUsdText(payUsd && payUsd > 0 && tokens > 0 ? trimUsd(tokens * payUsd) : text === "0" ? "0" : "");
      return;
    }
    setPayAmount(text);
  }

  function openPicker(side: PickerSide) {
    setPickerSide(side);
    setQuery("");
    setPickerOpen(true);
  }

  return (
    <main className="stage">
      <SiteNav />
      <WalletBridge />
      <h1 className="sr-only">Swap Solana tokens at the best price</h1>

      <div className={panel ? "desk open" : "desk"}>
      <div className="ticket">
      <div className="board">
      <section className={result ? "trade show-result" : "trade"}>
        <div className="trade-spin">
        <div className="tools" inert={result ? true : undefined}>
          <div className="trade-tab">
          <strong>Swap</strong>
          <button
            type="button"
            className={panel === "settings" ? "tune on" : "tune"}
            aria-label={`Swap settings, slippage ${formatPct(slippageBps)} percent`}
            aria-expanded={panel === "settings"}
            onClick={() => setPanel((current) => (current === "settings" ? null : "settings"))}
          >
            <svg className="tune-gear" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 4.7 15a1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 8.9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
            </svg>
            <span className="tune-pct">{formatPct(slippageBps)}%</span>
          </button>
          </div>
          <div className="tool-side">
            <button
              type="button"
              className={panel === "memo" ? "icon on" : "icon"}
              aria-label="Memo"
              aria-expanded={panel === "memo"}
              onClick={() => setPanel((current) => (current === "memo" ? null : "memo"))}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
                <path d="M7 4h7l4 4v12H7z" />
                <path d="M14 4v4h4M9 13h6M9 17h4" />
              </svg>
            </button>
            <button
              type="button"
              className={panel === "book" ? "icon on" : "icon"}
              aria-label="Order book"
              aria-expanded={panel === "book"}
              onClick={() => setPanel((current) => (current === "book" ? null : "book"))}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
                <path d="M5 7h6M5 12h4M5 17h5M19 7h-6M19 12h-4M19 17h-5" />
              </svg>
            </button>
            <button
              type="button"
              className={panel === "chart" ? "icon on" : "icon"}
              aria-label="Price chart"
              aria-expanded={panel === "chart"}
              onClick={() => setPanel((current) => (current === "chart" ? null : "chart"))}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
                <path d="M4 19V5M4 19h16" />
                <path d="M7 14l4-5 3 3 5-6" />
              </svg>
            </button>
          </div>
        </div>
        <div className="trade-front" inert={result ? true : undefined}>
        <div className="swap-stage">
          <div className="swap-face">
        <div className="pair">
          <div className="panel sell">
            <div className="row">
              <span>Sell</span>
              <div className={usdOn ? "sell-side usd" : "sell-side"}>
                <button
                  type="button"
                  className={usdOn ? "usd-toggle on" : "usd-toggle"}
                  aria-pressed={usdOn}
                  aria-label={usdOn ? "Enter amount in token units" : "Enter amount in USD"}
                  onClick={toggleUsd}
                >
                  $
                </button>
                <TokenChip key={pay.mint} token={pay} onOpen={() => openPicker("pay")} />
              </div>
            </div>
            <div className="amount">
              {usdOn ? <span className="dollar">$</span> : null}
              <input
                aria-label={usdOn ? "Amount to pay in USD" : "Amount to pay"}
                inputMode="decimal"
                type={usdOn ? "text" : "number"}
                min={usdOn ? undefined : "0"}
                step={usdOn ? undefined : "any"}
                value={usdOn ? usdText : payAmount}
                placeholder={usdOn ? "0.00" : "0.0"}
                onChange={(event) => {
                  const raw = event.target.value;
                  if (!usdOn) {
                    setPayAmount(raw);
                    return;
                  }
                  if (raw && !/^\d*\.?\d*$/.test(raw)) return;
                  setUsdText(raw);
                }}
              />
            </div>
            <div className="sell-meta">
            <span className="sub">{sellNote || (usdOn ? `≈ 0 ${pay.symbol}` : `1 ${pay.symbol} ≈ — ${receive.symbol}`)}</span>
              <div className="shares">
                <button type="button" onClick={() => applyShare(20)}>
                  20%
                </button>
                <button type="button" onClick={() => applyShare(50)}>
                  50%
                </button>
                <button type="button" onClick={() => applyShare(100)}>
                  Max
                </button>
              </div>
            </div>
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
              <TokenChip key={receive.mint} token={receive} onOpen={() => openPicker("receive")} />
            </div>
            <div className={quoting ? "quote busy" : "quote"} aria-busy={quoting}>
              {shownOut}
            </div>
            <span className="sub">{buyNote || "$—"}</span>
          </div>
        </div>

        <button
          className={swapping ? "swap busy" : "swap"}
          type="button"
          disabled={connected && (!order || swapping || quoting)}
          onClick={() => {
            if (!connected) {
              openWallet();
              return;
            }
            void swap();
          }}
        >
          <span className="swap-label">{!connected ? "Connect Wallet" : awaiting ? "Confirming…" : swapping ? "Signing…" : "Swap"}</span>
        </button>

        {error || message ? <p className={error ? "status error" : "status"}>{error || message}</p> : null}
          </div>
        </div>
        </div>
        <div className="trade-back" inert={result ? undefined : true}>
          <span className={result?.ok === false ? "result-mark bad" : "result-mark"} aria-hidden="true">
            <svg viewBox="0 0 52 52" width="52" height="52">
              <circle className="result-ring" cx="26" cy="26" r="24" />
              {result?.ok === false ? (
                <path className="result-tick" d="M18 18l16 16M34 18 18 34" />
              ) : (
                <path className="result-tick" d="M16 27.5 22.5 34 36 18.5" />
              )}
            </svg>
          </span>
          <h2>{result?.ok === false ? "Swap Failed" : "Swap Success"}</h2>
          {result?.signature && resultHref ? (
            <a className="result-tx" href={resultHref} target="_blank" rel="noreferrer">
              {shorten(result.signature, 4, 4)}
            </a>
          ) : null}
          {result && !result.ok && result.detail ? <p>{result.detail}</p> : null}
          <div className="result-actions">
            {result?.ok && resultHref ? (
              <a className="txns" href={resultHref} target="_blank" rel="noreferrer">
                Solscan
              </a>
            ) : null}
            <button type="button" className="result-done" onClick={() => setResult(null)}>
              Close
            </button>
          </div>
        </div>
        </div>
      </section>
      <aside
        className="chart-slot"
        inert={panel ? undefined : true}
        aria-label={shown === "settings" ? "Swap settings" : shown === "book" ? "Order book" : shown === "memo" ? "Memo" : "Price chart"}
      >
        {shown === "settings" ? (
          <section className="chart-card settings settings-card">
            <div className="settings-head">
              <h2>Swap Settings</h2>
              <button type="button" className="close" onClick={() => setPanel(null)} aria-label="Close">
                <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>

            <section className="set-block">
              <h3>
                Slippage Tolerance
                <button type="button" className="hint" aria-label="About slippage" title="The swap fails if the price moves past this.">
                  ?
                </button>
              </h3>
              <div className="opt-row">
                <button
                  type="button"
                  className={slippageMode === "auto" ? "opt on" : "opt"}
                  onClick={() => {
                    setSlippageMode("auto");
                    setCustomSlippage("");
                    setSlippageBps(AUTO_SLIPPAGE_BPS);
                  }}
                >
                  Auto
                </button>
                <span className="opt-rule" aria-hidden="true" />
                {SLIPPAGE_CHOICES.map((bps) => (
                  <button
                    key={bps}
                    type="button"
                    className={slippageMode === "set" && customSlippage === "" && slippageBps === bps ? "opt on" : "opt"}
                    onClick={() => {
                      setSlippageMode("set");
                      setCustomSlippage("");
                      setSlippageBps(bps);
                    }}
                  >
                    {formatPct(bps)}%
                  </button>
                ))}
                <label className={customSlippage !== "" ? "opt-field on" : "opt-field"}>
                  <input
                    inputMode="decimal"
                    aria-label="Custom slippage percent"
                    placeholder="Custom"
                    value={customSlippage}
                    onChange={(event) => {
                      const raw = event.target.value;
                      if (raw && !/^\d*\.?\d*$/.test(raw)) return;
                      setCustomSlippage(raw);
                      setSlippageMode("set");
                      const value = Number(raw);
                      if (!raw.trim() || !Number.isFinite(value)) return;
                      const bps = Math.round(value * 100);
                      if (bps >= 1 && bps <= 5000) setSlippageBps(bps);
                    }}
                  />
                  <span>%</span>
                </label>
              </div>
              <p>
                {slippageMode === "auto"
                  ? "We'll determine the optimal allowed slippage automatically for each swap."
                  : "The swap fails if the price moves past this."}
              </p>
            </section>

            <section className="set-block">
              <h3>
                Priority Fee
                <button type="button" className="hint" aria-label="About priority fee" title="A higher fee helps the swap land in a busy slot.">
                  ?
                </button>
              </h3>
              <div className="opt-row">
                <button type="button" className={feeMode === "max" ? "opt on" : "opt"} onClick={() => setFeeMode("max")}>
                  Max
                </button>
                <button type="button" className={feeMode === "exact" ? "opt on" : "opt"} onClick={() => setFeeMode("exact")}>
                  Exact
                </button>
                <label className="opt-field">
                  <input
                    inputMode="decimal"
                    aria-label="Priority fee in SOL"
                    value={feeText}
                    onChange={(event) => {
                      const raw = event.target.value;
                      if (raw && !/^\d*\.?\d*$/.test(raw)) return;
                      setFeeText(raw);
                    }}
                  />
                  <span>SOL</span>
                </label>
              </div>
              <p className="opt-note">
                <span>
                  {feeMode === "exact"
                    ? "Every swap uses this exact priority fee."
                    : "We'll automatically choose the optimal fee, up to the maximum you set."}
                </span>
                {feeEstimate(feeText, solUsd) ? <em>{feeEstimate(feeText, solUsd)}</em> : null}
              </p>
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
          </section>
        ) : null}
        {shown === "chart" ? <PairChart active={panel === "chart"} pay={pay} receive={receive} /> : null}
        {shown === "memo" ? (
          <section className="chart-card memo-card">
            <header className="chart-head">
              <strong>Memo</strong>
            </header>
            <label className="memo">
              <span>{brandWallet ? "Brand on this link" : "Memo"}</span>
              <input
                aria-label="Memo"
                maxLength={32}
                placeholder="Written on the swap"
                value={brand}
                onChange={(event) => setBrand(event.target.value)}
              />
            </label>
            <p className="memo-note">This text is stored on the transaction. It does not add a fee.</p>
          </section>
        ) : null}
        {shown === "book" ? <OrderBook active={panel === "book"} pay={pay} receive={receive} /> : null}
      </aside>
      </div>

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
              <img src="/goblock%20logo%20wordmark.png" alt="goblock" />
            </span>
          ) : null}
          <svg className={factsOpen ? "chev open" : "chev"} viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M6 14.5 12 8.5l6 6" />
          </svg>
        </button>
        <div className={factsOpen ? "facts-body open" : "facts-body"}>
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
        </div>
      </section>
      </div>
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
              <h2>{pickerSide === "pay" ? "Your tokens" : "Select a token"}</h2>
              <button type="button" className="close" onClick={() => setPickerOpen(false)} aria-label="Close">
                <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            <div className="scopes" role="tablist" aria-label="Token market">
              <button type="button" className={market === "spot" ? "on" : undefined} onClick={() => setMarket("spot")}>
                Spot
              </button>
              <button
                type="button"
                className={market === "equities" ? "on" : undefined}
                onClick={() => setMarket("equities")}
              >
                Equities
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
            <div className="pairs" aria-label="Pairs">
              {PAIRS.map((token) => (
                <button key={token.mint} type="button" onClick={() => chooseToken(token)}>
                  <TokenMark token={token} />
                  {token.symbol}
                </button>
              ))}
            </div>
            <ul className="token-list">
              {known.map((token) => (
                <li key={token.mint}>
                  <button type="button" onClick={() => chooseToken(token)}>
                    <TokenMark token={token} />
                    <span className="token-copy">
                      <strong>
                        {token.symbol}
                        {token.verified ? <Verified /> : null}
                      </strong>
                      <small>
                        {token.name} <em>{shorten(token.mint, 4, 4)}</em>
                      </small>
                    </span>
                    {holdingAmount(token) ? (
                      <span className="bal">{formatAtomic(holdingAmount(token) as string, token.decimals, 4)}</span>
                    ) : token.marketCap || token.createdAt ? (
                      <span className="token-meta">
                        {token.marketCap ? <strong>{formatMcap(token.marketCap)}</strong> : null}
                        {token.createdAt ? <small>{formatAge(token.createdAt)}</small> : null}
                      </span>
                    ) : null}
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
              {pickerSide === "pay" && market === "spot" && !connected ? (
                <li className="empty wallet-empty">
                  <p>Connect a wallet to see the tokens it holds.</p>
                  <button type="button" className="swap" onClick={() => { setPickerOpen(false); openWallet(); }}>
                    Connect wallet
                  </button>
                </li>
              ) : null}
              {listing && !known.length && !(pickerSide === "pay" && market === "spot" && !connected) ? <li className="empty">Loading tokens…</li> : null}
              {!listing && !known.length && !pasted && !(pickerSide === "pay" && market === "spot" && !connected) ? (
                <li className="empty">
                  {pickerSide === "pay" && market === "spot"
                    ? "This wallet has no tokens yet."
                    : market === "equities"
                      ? "No stock matches that search."
                      : "No token matches that search."}
                </li>
              ) : null}
            </ul>
          </div>
        </div>
      ) : null}
    </main>
  );
}

async function loadHoldings(connection: Connection, owner: PublicKey): Promise<Holding[]> {
  const [lamports, classic, extra] = await Promise.all([
    connection.getBalance(owner, "confirmed"),
    connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM }, "confirmed"),
    connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_2022 }, "confirmed"),
  ]);
  const rows: Holding[] = [{ ...SOL, name: "Solana", verified: true, amount: String(lamports) }];
  for (const account of [...classic.value, ...extra.value]) {
    const info = (
      account.account.data as {
        parsed?: { info?: { mint?: string; tokenAmount?: { amount?: string; decimals?: number; uiAmount?: number | null } } };
      }
    ).parsed?.info;
    const mint = info?.mint;
    const amount = info?.tokenAmount?.amount;
    const decimals = info?.tokenAmount?.decimals;
    if (!mint || !amount || decimals === undefined || amount === "0" || mint === SOL.mint) continue;
    const known = directoryToken(mint);
    rows.push({
      symbol: known?.symbol ?? "TOKEN",
      name: known?.name ?? "Token",
      mint,
      decimals,
      image: known?.image ?? (mint.endsWith("pump") ? `https://images.pump.fun/coin-image/${mint}` : undefined),
      verified: known?.verified,
      amount,
    });
  }
  return rows;
}

function formatMcap(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `$${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(abs / 1e3).toFixed(1)}K`;
  return `$${abs.toFixed(0)}`;
}

function formatAge(createdAt: number) {
  const seconds = Math.max(0, Math.floor((Date.now() - createdAt) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function holdingAmount(token: ListedToken | Holding): string | null {
  return "amount" in token && typeof token.amount === "string" ? token.amount : null;
}

function directoryToken(mint: string): ListedToken | undefined {
  if (mint === USDC.mint) return { ...USDC, name: "USD Coin", verified: true };
  if (mint === FARTCOIN.mint) return { ...FARTCOIN, name: "Fartcoin", verified: true };
  for (const list of tokenLists.values()) {
    const found = list.find((token) => token.mint === mint);
    if (found) return found;
  }
  return undefined;
}

function impactLabel(priceImpactPct: string): string {
  const percent = Number(priceImpactPct) * 100;
  if (!Number.isFinite(percent)) return "—";
  if (Math.abs(percent) < 0.0005) return "0%";
  return formatImpact(priceImpactPct);
}

function TokenChip({ token, onOpen }: { token: TokenInfo; onOpen: () => void }) {
  const [failed, setFailed] = useState(false);
  return (
    <button className="token" type="button" onClick={onOpen}>
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
  const sources = token.image ? [token.image] : [];
  const pump = token.mint.endsWith("pump") ? `https://images.pump.fun/coin-image/${token.mint}` : "";
  if (pump && !sources.includes(pump)) sources.push(pump);
  return sources;
}

function Verified() {
  return (
    <svg className="verified" viewBox="0 0 16 16" width="13" height="13" aria-label="Verified">
      <circle cx="8" cy="8" r="7.25" />
      <path d="M4.7 8.15 6.95 10.35 11.4 5.75" />
    </svg>
  );
}
