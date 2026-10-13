"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { PLANS } from "@/lib/plans";
import { formatAtomic, shorten } from "@/lib/units";
import { useSignIn } from "../dashboard/_ui/sign-in";
import { currentSession, saveSession } from "../dashboard/_ui/session";
import { connection, watchSignature } from "../solana";
import { useGoblockWallet } from "../wallet";

const TOKEN = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ATA_PROGRAM = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const MEMO = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
const CHOICES = PLANS.filter((plan) => plan.id === "builder" || plan.id === "starter");

type PlanId = "builder" | "starter" | "enterprise";
type Asset = "SOL" | "USDC";
type Offer = { id: string; mint: string; atomic: string; decimals: number; quote: string };
type Quote = {
  plan: string;
  name: string;
  usd: number;
  listUsd: number;
  rpm: number;
  days: number;
  treasury: string;
  voucher: { code: string; label: string } | null;
  voucherError: string;
  assets: { SOL: Offer | null; USDC: Offer };
};
type Issued = { key: string; label: string; expiresAt: string | null; rpm: number };

function plainPayError(caught: unknown, asset: Asset): string {
  const text = caught instanceof Error ? caught.message : "";
  if (/reject|cancel|denied|declined/i.test(text)) return "You cancelled the request in your wallet.";
  if (/insufficient funds|insufficient lamports|custom program error: 0x1\b|no record of a prior credit/i.test(text)) {
    return asset === "SOL" ? "Not enough SOL in this wallet for the payment." : "Not enough USDC in this wallet for the payment.";
  }
  if (/InvalidAccountData|invalid account data/i.test(text)) {
    return asset === "USDC"
      ? "This wallet has no USDC to send. Add USDC first, or pay with SOL."
      : "The payment account could not be used. Refresh the price and try again.";
  }
  if (/blockhash|block height exceeded|expired before it landed/i.test(text)) return "The price expired. Refresh it and try again.";
  if (text && text.length < 140 && !/logs:|program /i.test(text)) return text;
  const reason = text.match(/Error processing Instruction \d+: ([^.\n]+)/)?.[1]?.trim();
  if (reason && reason.length < 80) return `The payment failed: ${reason}.`;
  return "The payment could not be sent. Refresh the price and try again.";
}

function normalize(value: string | undefined): PlanId {
  if (value === "builder" || value === "enterprise") return value;
  return "starter";
}

function tokenAccount(owner: PublicKey, mint: PublicKey) {
  return PublicKey.findProgramAddressSync([owner.toBuffer(), TOKEN.toBuffer(), mint.toBuffer()], ATA_PROGRAM)[0];
}

function transferChecked(source: PublicKey, mint: PublicKey, dest: PublicKey, owner: PublicKey, amount: bigint, decimals: number) {
  const data = new Uint8Array(10);
  const view = new DataView(data.buffer);
  data[0] = 12;
  view.setBigUint64(1, amount, true);
  data[9] = decimals;
  return new TransactionInstruction({
    programId: TOKEN,
    keys: [
      { pubkey: source, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: dest, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
    data: data as Buffer,
  });
}

export function CheckoutPay({ initialPlan }: { initialPlan?: string }) {
  const router = useRouter();
  const wallet = useGoblockWallet();
  const { address, connected, openWallet, signIn } = useSignIn();
  const [plan, setPlan] = useState<PlanId>(normalize(initialPlan));
  const [asset, setAsset] = useState<Asset>("USDC");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(plan !== "enterprise");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [issued, setIssued] = useState<Issued | null>(null);
  const [copied, setCopied] = useState(false);
  const [tick, setTick] = useState(0);
  const [draft, setDraft] = useState("");
  const [code, setCode] = useState("");
  const [catalog, setCatalog] = useState<{ builderUsd: number; builderRpm: number; starterUsd: number; starterRpm: number } | null>(null);

  useEffect(() => {
    setPlan(normalize(initialPlan));
  }, [initialPlan]);

  useEffect(() => {
    let gone = false;
    void fetch("/api/config", { cache: "no-store" })
      .then((response) => response.json())
      .then((body: { plans?: { builderUsd: number; builderRpm: number; starterUsd: number; starterRpm: number } }) => {
        if (!gone && body.plans) setCatalog(body.plans);
      })
      .catch(() => undefined);
    return () => {
      gone = true;
    };
  }, []);

  useEffect(() => {
    if (plan === "enterprise") {
      setQuote(null);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setError("");
    setQuote(null);
    const params = new URLSearchParams({ plan });
    if (code.trim()) params.set("code", code.trim());
    fetch(`/api/checkout?${params}`, { cache: "no-store", signal: ctrl.signal })
      .then(async (response) => {
        const body = (await response.json()) as Quote & { msg?: string };
        if (!response.ok) throw new Error(body.msg ?? "The price could not be loaded.");
        setQuote(body);
        setAsset((current) => (current === "SOL" && !body.assets.SOL ? "USDC" : current));
      })
      .catch((caught: unknown) => {
        if (caught instanceof Error && caught.name === "AbortError") return;
        setError(caught instanceof Error ? caught.message : "The price could not be loaded.");
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [plan, tick, code]);

  const offer = quote?.assets[asset] ?? null;
  const amount = offer ? formatAtomic(offer.atomic, offer.decimals, asset === "SOL" ? 6 : 2) : "";

  function choose(next: PlanId) {
    setIssued(null);
    setError("");
    setPlan(next);
    router.replace(next === "starter" ? "/checkout" : `/checkout?plan=${next}`, { scroll: false });
  }

  async function pay() {
    if (!connected || !wallet.publicKey) {
      openWallet();
      return;
    }
    setBusy("Waiting for your wallet");
    setError("");
    try {
      let session = currentSession();
      if (!session || session.wallet !== address) {
        setBusy("Sign in with your wallet");
        await signIn();
        session = currentSession();
        if (!session || session.wallet !== address) return;
      }
      if (!offer || !quote) throw new Error("The price expired. Refresh and try again.");
      const payer = wallet.publicKey;
      const treasury = new PublicKey(quote.treasury);
      const instructions = [
        new TransactionInstruction({
          programId: MEMO,
          keys: [{ pubkey: payer, isSigner: true, isWritable: false }],
          data: new TextEncoder().encode(`goblock:${offer.id}`) as Buffer,
        }),
      ];
      if (offer.atomic !== "0" && asset === "SOL") {
        instructions.push(
          SystemProgram.transfer({ fromPubkey: payer, toPubkey: treasury, lamports: Number(offer.atomic) }),
        );
      } else if (offer.atomic !== "0") {
        const mint = new PublicKey(offer.mint);
        const dest = tokenAccount(treasury, mint);
        instructions.push(
          new TransactionInstruction({
            programId: ATA_PROGRAM,
            keys: [
              { pubkey: payer, isSigner: true, isWritable: true },
              { pubkey: dest, isSigner: false, isWritable: true },
              { pubkey: treasury, isSigner: false, isWritable: false },
              { pubkey: mint, isSigner: false, isWritable: false },
              { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
              { pubkey: TOKEN, isSigner: false, isWritable: false },
            ],
            data: Uint8Array.from([1]) as Buffer,
          }),
          transferChecked(tokenAccount(payer, mint), mint, dest, payer, BigInt(offer.atomic), offer.decimals),
        );
      }
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      const message = new TransactionMessage({ payerKey: payer, recentBlockhash: blockhash, instructions }).compileToV0Message();
      setBusy("Confirm the payment in your wallet");
      const signature = await wallet.sendTransaction(new VersionedTransaction(message));
      setBusy("Confirming the payment");
      const status = await watchSignature(signature, lastValidBlockHeight);
      if (status !== "confirmed") {
        throw new Error(
          status === "failed"
            ? "The payment transaction failed."
            : "The transaction expired before it landed. Refresh the price and try again.",
        );
      }
      setBusy("Issuing the key");
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { authorization: `Bearer ${session.token}`, "content-type": "application/json" },
        body: JSON.stringify({ quote: offer.quote, signature }),
      });
      const body = (await response.json()) as Issued & { msg?: string };
      if (response.status === 401) saveSession(null);
      if (!response.ok || !body.key) throw new Error(body.msg ?? "The key could not be issued.");
      setIssued({ ...body, rpm: quote.rpm });
    } catch (caught) {
      setError(plainPayError(caught, asset));
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="c-pay">
      <div className="c-pay-plans">
        {CHOICES.map((item) => {
          const price = catalog ? `$${item.id === "builder" ? catalog.builderUsd : catalog.starterUsd}` : item.price;
          const cap = catalog ? `${item.id === "builder" ? catalog.builderRpm : catalog.starterRpm} requests / min` : item.cap;
          return (
          <button
            key={item.id}
            type="button"
            className={plan === item.id ? "c-pay-plan on" : "c-pay-plan"}
            onClick={() => choose(item.id as PlanId)}
          >
            <span>
              {item.name}
              {item.featured ? <i>Popular</i> : null}
            </span>
            <strong>
              {price}
              <small>{item.period}</small>
            </strong>
            <em>{cap}</em>
          </button>
          );
        })}
        <button type="button" className={plan === "enterprise" ? "c-pay-plan on" : "c-pay-plan"} onClick={() => choose("enterprise")}>
          <span>Enterprise</span>
          <strong>Custom</strong>
          <em>A cap sized with the goblock team</em>
        </button>
      </div>

      {issued ? (
        <div className="c-pay-card">
          <small>Key ready · {issued.label}</small>
          <p className="c-pay-lead">Copy it now. goblock shows a key once and cannot show it again.</p>
          <div className="c-pay-secret">
            <code>{issued.key}</code>
            <button
              type="button"
              onClick={() => void navigator.clipboard?.writeText(issued.key).then(() => setCopied(true))}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p>
            {issued.rpm} requests a minute, and 0 bps on every pair
            {issued.expiresAt ? ` until ${new Date(issued.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}.
            After that the key keeps working at the free rate.
          </p>
          <Link className="p-btn" href="/dashboard">
            Open the dashboard
          </Link>
        </div>
      ) : plan === "enterprise" ? (
        <div className="c-pay-card">
          <small>Enterprise</small>
          <h2>A cap sized to your traffic.</h2>
          <p className="c-pay-lead">
            Enterprise is arranged with the goblock team. Builder and Starter can be paid here.
          </p>
          <Link className="p-btn" href="/docs/plans">
            Read plans
          </Link>
        </div>
      ) : (
        <div className="c-pay-card">
          <small>{quote ? `${quote.name} · ${quote.days} days` : "Monthly plan"}</small>
          <div className="c-pay-assets" role="group" aria-label="Payment asset">
            {(["USDC", "SOL"] as const).map((name) => (
              <button
                key={name}
                type="button"
                className={asset === name ? "on" : undefined}
                disabled={name === "SOL" && !!quote && !quote.assets.SOL}
                onClick={() => setAsset(name)}
              >
                {name}
              </button>
            ))}
          </div>
          <p className="c-pay-amount">
            {loading ? "…" : amount ? `${amount} ${asset}` : "—"}
            {quote?.voucher ? <s>${quote.listUsd}</s> : null}
            {quote ? <span>${quote.usd}</span> : null}
          </p>
          {quote?.voucher ? (
            <p className="c-pay-off">
              {quote.voucher.code} applied · {quote.voucher.label}
            </p>
          ) : null}
          <form
            className="c-pay-code"
            onSubmit={(event) => {
              event.preventDefault();
              setCode(draft.trim());
              setTick((value) => value + 1);
            }}
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value.toUpperCase())}
              placeholder="Discount code"
              maxLength={16}
              spellCheck={false}
              autoComplete="off"
              aria-label="Discount code"
            />
            <button type="submit">Apply</button>
            {code ? (
              <button
                type="button"
                onClick={() => {
                  setDraft("");
                  setCode("");
                }}
              >
                Remove
              </button>
            ) : null}
          </form>
          {quote?.voucherError ? <p className="c-pay-error">{quote.voucherError}</p> : null}
          <dl>
            <div>
              <dt>Requests</dt>
              <dd>{quote ? `${quote.rpm} / min` : "—"}</dd>
            </div>
            <div>
              <dt>goblock fee</dt>
              <dd>0 bps</dd>
            </div>
            <div>
              <dt>Paid to</dt>
              <dd>
                {quote ? (
                  <a href={`https://solscan.io/account/${quote.treasury}`} target="_blank" rel="noreferrer">
                    {shorten(quote.treasury, 4, 4)}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
          </dl>
          {asset === "SOL" && quote && !quote.assets.SOL ? <p className="c-pay-error">SOL price is unavailable. Pay with USDC.</p> : null}
          {error ? <p className="c-pay-error">{error}</p> : null}
          <button className="p-btn" type="button" disabled={Boolean(busy) || (connected && (loading || !offer))} onClick={() => void pay()}>
            {busy ||
              (connected ? (offer ? (offer.atomic === "0" ? "Claim key" : `Pay ${amount} ${asset}`) : "Price unavailable") : "Connect wallet")}
          </button>
          <button className="c-pay-refresh" type="button" onClick={() => setTick((value) => value + 1)}>
            Refresh price
          </button>
          <p className="c-pay-fine">
            The payment goes to the goblock wallet. The key lasts {quote?.days ?? 30} days. Keep it on your server.
          </p>
        </div>
      )}
    </div>
  );
}
