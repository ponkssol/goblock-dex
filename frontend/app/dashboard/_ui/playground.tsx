"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { formatAtomic, formatImpact, shorten } from "@/lib/units";
import { CodeBlock } from "../../code-block";
import { SOL, USDC } from "../../docs/parts";
import { Icon } from "./icons";
import { Card, PageHead, useLoaded } from "./shell";

const TOKENS = [
  { symbol: "SOL", mint: SOL, decimals: 9 },
  { symbol: "USDC", mint: USDC, decimals: 6 },
  { symbol: "USDT", mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", decimals: 6 },
];

const KEY_STORE = "goblock.playground.key";
const HIGH_IMPACT = 0.05;

const STATUS: Record<number, string> = {
  200: "OK",
  400: "Bad Request",
  401: "Unauthorized",
  404: "Not Found",
  429: "Too Many Requests",
  500: "Server Error",
  503: "Unavailable",
};

type Form = {
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageBps: string;
  userPublicKey: string;
  platformFeeBps: string;
  feeWallet: string;
};

type Quote = {
  venue?: string;
  route?: string;
  inAmount?: string;
  outAmount?: string;
  minOutAmount?: string;
  priceImpactPct?: string;
  feeBps?: number;
  networkFeeLamports?: string;
  inputMintDecimals?: number;
  outputMintDecimals?: number;
  transaction?: string;
  msg?: string;
};

type Result = { status: number; ms: number; body: Quote | null; text: string; form: Form };

const START: Form = {
  inputMint: SOL,
  outputMint: USDC,
  amount: "10000000",
  slippageBps: "100",
  userPublicKey: "",
  platformFeeBps: "",
  feeWallet: "",
};

function symbolOf(mint: string) {
  return TOKENS.find((token) => token.mint === mint.trim())?.symbol;
}

function labelOf(mint: string) {
  return symbolOf(mint) ?? shorten(mint.trim(), 4, 4);
}

/** Groups the whole part of a decimal string with commas, keeping every digit. */
function grouped(value: string) {
  const [whole, fraction] = value.split(".");
  const text = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fraction ? `${text}.${fraction}` : text;
}

function paramsOf(form: Form) {
  const params = new URLSearchParams({
    inputMint: form.inputMint.trim(),
    outputMint: form.outputMint.trim(),
    amount: form.amount.trim(),
    slippageBps: form.slippageBps.trim(),
  });
  if (form.userPublicKey.trim()) params.set("userPublicKey", form.userPublicKey.trim());
  if (form.platformFeeBps.trim()) params.set("platformFeeBps", form.platformFeeBps.trim());
  if (form.feeWallet.trim()) params.set("feeWallet", form.feeWallet.trim());
  return params;
}

function snippetsOf(origin: string, params: URLSearchParams) {
  const entries = [...params.entries()];
  const curl = [
    `curl -G "${origin}/api/v1/swap" \\`,
    `  -H "x-api-key: $GOBLOCK_API_KEY" \\`,
    ...entries.map(([name, value], index) => `  -d ${name}=${value}${index < entries.length - 1 ? " \\" : ""}`),
  ].join("\n");
  const fields = entries.map(([name, value]) => `  ${name}: "${value}",`).join("\n");
  const ts = `const params = new URLSearchParams({\n${fields}\n});\n\nconst res = await fetch(\`${origin}/api/v1/swap?\${params}\`, {\n  headers: { "x-api-key": process.env.GOBLOCK_API_KEY },\n});\nconst quote = await res.json();`;
  return [
    { label: "cURL", code: curl },
    { label: "TypeScript", code: ts },
  ];
}

function pretty(body: Quote | null, text: string) {
  if (!body) return text || "(empty body)";
  return JSON.stringify(
    body,
    (name, value) =>
      name === "transaction" && typeof value === "string" && value.length > 96
        ? `${value.slice(0, 64)}… (${value.length} characters)`
        : value,
    2,
  );
}

function MintField({ label, value, onChange }: { label: string; value: string; onChange: (mint: string) => void }) {
  return (
    <div className="m-field pg-field">
      <small>{label}</small>
      <input value={value} onChange={(event) => onChange(event.target.value)} spellCheck={false} placeholder="Token mint" />
      <div className="pg-chips">
        {TOKENS.map((token) => (
          <button
            key={token.mint}
            type="button"
            className={value.trim() === token.mint ? "on" : undefined}
            onClick={() => onChange(token.mint)}
          >
            {token.symbol}
          </button>
        ))}
      </div>
    </div>
  );
}

function Preview({ quote, form }: { quote: Quote; form: Form }) {
  const inDecimals = quote.inputMintDecimals ?? 0;
  const outDecimals = quote.outputMintDecimals ?? 0;
  const amount = (value: string | undefined, decimals: number) => (value ? grouped(formatAtomic(value, decimals)) : "—");
  const impact = Number(quote.priceImpactPct ?? "0");
  const high = Number.isFinite(impact) && impact >= HIGH_IMPACT;

  const facts: [string, ReactNode][] = [
    ["Venue", quote.route ?? quote.venue ?? "—"],
    ["Minimum out", `${amount(quote.minOutAmount, outDecimals)} ${labelOf(form.outputMint)}`],
    [
      "Price impact",
      <span key="impact" className={high ? "pg-warn" : undefined}>
        {quote.priceImpactPct ? formatImpact(quote.priceImpactPct) : "—"}
        {high ? <em>High</em> : null}
      </span>,
    ],
    ["goblock fee", quote.feeBps === undefined ? "—" : `${quote.feeBps} bps`],
    ["Network fee", quote.networkFeeLamports ? `${formatAtomic(quote.networkFeeLamports, 9, 9)} SOL` : "—"],
    ["Transaction", quote.transaction ? "Included, unsigned" : "Not built"],
  ];

  return (
    <div className="pg-preview">
      <div className="pg-trade">
        <div>
          <small>You pay</small>
          <b>{amount(quote.inAmount, inDecimals)}</b>
          <span>{labelOf(form.inputMint)}</span>
        </div>
        <i aria-hidden="true">
          <Icon name="right" size={18} />
        </i>
        <div>
          <small>You get</small>
          <b>{amount(quote.outAmount, outDecimals)}</b>
          <span>{labelOf(form.outputMint)}</span>
        </div>
      </div>
      <dl className="pg-facts">
        {facts.map(([name, value]) => (
          <div key={name}>
            <dt>{name}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function PlaygroundView() {
  const { overview, session, created, refresh, placeholder } = useLoaded();
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [form, setForm] = useState<Form>(START);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [view, setView] = useState<"preview" | "json">("preview");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    setKey(sessionStorage.getItem(KEY_STORE) ?? created?.key ?? "");
  }, [created]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(""), 1400);
    return () => window.clearTimeout(timer);
  }, [copied]);

  if (!overview) return placeholder;
  const activeKeys = overview.keys.filter((item) => !item.revokedAt).length;
  const params = paramsOf(form);
  const inSymbol = symbolOf(form.inputMint);
  const inDecimals = TOKENS.find((token) => token.symbol === inSymbol)?.decimals;
  const amountHint =
    inSymbol && inDecimals !== undefined && /^[1-9]\d*$/.test(form.amount.trim())
      ? `${grouped(formatAtomic(form.amount.trim(), inDecimals, inDecimals))} ${inSymbol}`
      : "Atomic units of the input token";

  const set = (name: keyof Form) => (value: string) => setForm((current) => ({ ...current, [name]: value }));

  const saveKey = (value: string) => {
    setKey(value);
    if (value.trim()) sessionStorage.setItem(KEY_STORE, value.trim());
    else sessionStorage.removeItem(KEY_STORE);
  };

  const copy = (name: string, text: string) => void navigator.clipboard?.writeText(text).then(() => setCopied(name));

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!key.trim()) return setError("Paste an API key first.");
    setBusy(true);
    setError("");
    const started = performance.now();
    try {
      const response = await fetch(`/api/v1/swap?${params}`, {
        cache: "no-store",
        headers: { "x-api-key": key.trim() },
      });
      const text = await response.text();
      let body: Quote | null = null;
      try {
        body = JSON.parse(text) as Quote;
      } catch {
        body = null;
      }
      setResult({ status: response.status, ms: Math.round(performance.now() - started), body, text, form });
      setView(response.ok ? "preview" : "json");
      void refresh();
    } catch {
      setError("The request did not reach the API. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const ok = result ? result.status >= 200 && result.status < 300 : false;
  const raw = result ? (result.body ? JSON.stringify(result.body, null, 2) : result.text) : "";

  return (
    <>
      <PageHead title="Playground" sub="Send real requests to /api/v1/swap with your key. Nothing is signed or sent on-chain.">
        <Link className="p-btn line" href="/docs/swap">
          API Reference
          <Icon name="arrow" size={16} />
        </Link>
      </PageHead>

      <div className="pg-bar">
        <span className="pg-verb">GET</span>
        <code className="pg-url" title={`${origin}/api/v1/swap?${params}`}>
          {origin}/api/v1/swap<em>?{params.toString()}</em>
        </code>
        <button type="button" className="pg-copy" onClick={() => copy("url", `${origin}/api/v1/swap?${params}`)}>
          {copied === "url" ? "Copied" : "Copy URL"}
        </button>
        <button className="p-btn pg-go" type="submit" form="pg-form" disabled={busy}>
          {busy ? <span className="au-spin" aria-hidden="true" /> : <Icon name="play" size={16} />}
          {busy ? "Sending…" : "Send"}
        </button>
      </div>

      <div className="ds-grid pg-grid">
        <section className="ds-panel pg-panel">
          <header className="ds-panel-head">
            <div>
              <h2>Parameters</h2>
              <p>Query string and the x-api-key header.</p>
            </div>
            <button
              type="button"
              className="k-link"
              disabled={busy}
              onClick={() => {
                setForm(START);
                setResult(null);
                setError("");
              }}
            >
              Reset
            </button>
          </header>

          <form id="pg-form" className="pg-form" onSubmit={(event) => void send(event)}>
            <div className="m-field pg-field">
              <small>x-api-key</small>
              <div className="pg-key">
                <input
                  type={showKey ? "text" : "password"}
                  value={key}
                  onChange={(event) => saveKey(event.target.value)}
                  placeholder="gb_live_…"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button type="button" className="pg-copy" onClick={() => setShowKey((value) => !value)}>
                  {showKey ? "Hide" : "Show"}
                </button>
              </div>
              <em>
                {activeKeys ? (
                  "Paste a key from API Keys. It stays in this browser tab only."
                ) : (
                  <>
                    You have no active key yet. <Link href="/dashboard/keys#create">Create one</Link> and paste it here.
                  </>
                )}
              </em>
            </div>

            <div className="pg-pair">
              <MintField label="inputMint" value={form.inputMint} onChange={set("inputMint")} />
              <button
                type="button"
                className="pg-flip"
                aria-label="Swap input and output"
                onClick={() => setForm((current) => ({ ...current, inputMint: current.outputMint, outputMint: current.inputMint }))}
              >
                <Icon name="refresh" size={16} />
              </button>
              <MintField label="outputMint" value={form.outputMint} onChange={set("outputMint")} />
            </div>

            <div className="pg-row">
              <label className="m-field pg-field">
                <small>amount</small>
                <input value={form.amount} onChange={(event) => set("amount")(event.target.value)} inputMode="numeric" />
                <em>{amountHint}</em>
              </label>
              <label className="m-field pg-field">
                <small>slippageBps</small>
                <input
                  value={form.slippageBps}
                  onChange={(event) => set("slippageBps")(event.target.value)}
                  inputMode="numeric"
                />
                <em>100 bps is 1%.</em>
              </label>
            </div>

            <details className="pg-more">
              <summary>
                Optional parameters
                <Icon name="plus" size={14} />
              </summary>
              <label className="m-field pg-field">
                <small>userPublicKey</small>
                <div className="pg-key">
                  <input
                    value={form.userPublicKey}
                    onChange={(event) => set("userPublicKey")(event.target.value)}
                    placeholder="Wallet that would sign"
                    spellCheck={false}
                  />
                  <button type="button" className="pg-copy" onClick={() => set("userPublicKey")(session.wallet)}>
                    Mine
                  </button>
                </div>
                <em>Adds an unsigned transaction to the response. The playground never signs it.</em>
              </label>
              <div className="pg-row">
                <label className="m-field pg-field">
                  <small>platformFeeBps</small>
                  <input
                    value={form.platformFeeBps}
                    onChange={(event) => set("platformFeeBps")(event.target.value)}
                    placeholder={`${overview.platformFee.minBps}–${overview.platformFee.maxBps}`}
                    inputMode="numeric"
                  />
                </label>
                <label className="m-field pg-field">
                  <small>feeWallet</small>
                  <div className="pg-key">
                    <input
                      value={form.feeWallet}
                      onChange={(event) => set("feeWallet")(event.target.value)}
                      placeholder="Wallet that gets your fee"
                      spellCheck={false}
                    />
                    <button type="button" className="pg-copy" onClick={() => set("feeWallet")(session.wallet)}>
                      Mine
                    </button>
                  </div>
                </label>
              </div>
            </details>

            {error ? <p className="b-error">{error}</p> : null}
          </form>
        </section>

        <section className="ds-panel pg-panel pg-response">
          <header className="ds-panel-head">
            <div>
              <h2>Response</h2>
              <p>{result ? `${labelOf(result.form.inputMint)} to ${labelOf(result.form.outputMint)}` : "Nothing sent yet."}</p>
            </div>
            {result ? (
              <span className={ok ? "pg-status ok" : "pg-status bad"}>
                <i aria-hidden="true" />
                {result.status} {STATUS[result.status] ?? ""} · {result.ms.toLocaleString("en-US")} ms
              </span>
            ) : null}
          </header>

          {result ? (
            <>
              <div className="pg-tabs">
                <div className="m-seg" role="tablist" aria-label="Response view">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={view === "preview"}
                    className={view === "preview" ? "on" : undefined}
                    onClick={() => setView("preview")}
                  >
                    Preview
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={view === "json"}
                    className={view === "json" ? "on" : undefined}
                    onClick={() => setView("json")}
                  >
                    JSON
                  </button>
                </div>
                <button type="button" className={copied === "body" ? "pg-copy done" : "pg-copy"} onClick={() => copy("body", raw)}>
                  {copied === "body" ? "Copied" : "Copy JSON"}
                </button>
              </div>

              <div className="pg-out">
                {view === "json" ? (
                  <pre className="ds-pre pg-json">{pretty(result.body, result.text)}</pre>
                ) : ok && result.body ? (
                  <Preview quote={result.body} form={result.form} />
                ) : (
                  <div className="pg-error">
                    <b>{result.status} {STATUS[result.status] ?? "Error"}</b>
                    <p>{result.body?.msg ?? "The API answered with an error."}</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="pg-idle">
              <span>
                <Icon name="play" size={20} />
              </span>
              <b>Press Send to run the request</b>
              <p>The status, timing, and quote show up here. Each request counts toward the key&apos;s usage.</p>
            </div>
          )}
        </section>
      </div>

      <Card plain title="Same request in code" sub="Updates as you edit. Keep the key in GOBLOCK_API_KEY on your server.">
        <CodeBlock className="slim" snippets={snippetsOf(origin, params)} />
      </Card>
    </>
  );
}
