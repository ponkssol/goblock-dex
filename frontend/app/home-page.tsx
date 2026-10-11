"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { CodeBlock, type Snippet } from "./code-block";
import { FLOW, FlowList, FlowStage } from "./flow";
import { m } from "./motion";
import { Reveal } from "./reveal";
import { SiteFoot } from "./site-foot";
import { SiteNav } from "./site-nav";
import { useWalletLite } from "./wallet-lite";
import "./home.css";
import "./sections.css";
import "./pages.css";

const VENUES = [
  {
    name: "Raydium",
    src: "/venues/raydium.svg",
    body: "Pooled with the other venues, then kept only if the output is better.",
  },
  {
    name: "Orca",
    src: "/venues/orca.svg",
    body: "Whirlpool quotes sit in the same list, with the fee shown on the row.",
  },
  {
    name: "Meteora",
    src: "/venues/meteora.svg",
    body: "DAMM and DBC routes are priced before the wallet ever opens.",
  },
  {
    name: "PumpSwap",
    src: "/venues/pumpswap.svg",
    body: "Bonding-curve tokens are quoted beside the AMM venues.",
  },
];

const REASONS = [
  ["One quote", "Four venues are checked, and the better output is the one you see."],
  ["Your keys", "goblock never holds the tokens. The wallet signs the transaction."],
  ["Shown first", "Rate, impact, and minimum received stay on the card."],
  ["No site fee", "A swap started here does not add a goblock fee."],
];

const QUOTES = [
  ["Meteora", "1.093913", "0.18%"],
  ["Orca", "1.092204", "0.21%"],
  ["Raydium", "1.091041", "0.24%"],
  ["PumpSwap", "1.088840", "0.31%"],
];

const PANELS = {
  quote: ["QUOTE  SOL → USDC", "amount  0.01", "best    Meteora  1.093913", "impact  0.18%", "min     1.092000"],
  route: ["ROUTE  Meteora DAMM", "in     SOL", "out    USDC", "pool   checked live", "fee    venue only"],
  receipt: ["SIGN   once", "wallet your wallet", "out    the token account you own", "floor  minimum received", "done   signature on Solscan"],
} as const;

const TABS = [
  ["quote", "Quote", "What you get back"],
  ["route", "Route", "Where the swap fills"],
  ["receipt", "Receipt", "What your wallet signs"],
] as const;

const CHECKS = [
  "Minimum received is on the transaction.",
  "The output account is yours.",
  "A swap from this page adds no site fee.",
];

const STEPS = [
  ["Compare", "Raydium, Orca, Meteora, and PumpSwap are priced on one card."],
  ["Read it", "The pool, the impact, and the minimum out are visible before you sign."],
  ["Sign once", "The wallet asks a single time. goblock does not take custody."],
  ["Keep it", "The receipt stores the signature and opens it on Solscan."],
];

const SEGMENTS = [
  {
    title: "Traders",
    tag: "Trade page",
    body: "Swap from the Trade page with no site fee. The wallet you already use signs it.",
    chip: "0 bps site fee",
    href: "/trade",
    link: "Start trading",
    icon: "M7 7h12l-3-3M17 17H5l3 3",
  },
  {
    title: "Trading bots",
    tag: "API",
    body: "One GET returns the better route and a transaction ready to sign. The bot keeps its own keys.",
    chip: "GET /api/v1/swap",
    href: "/docs/swap",
    link: "Read the API",
    icon: "M9 3h6M12 3v3M5 10a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3zM9.5 13v.01M14.5 13v.01M2 12v3M22 12v3",
  },
  {
    title: "Wallets & apps",
    tag: "API",
    body: "Put goblock quotes inside your own swap screen. Your users sign in the wallet they already have.",
    chip: "userPublicKey → transaction",
    href: "/docs/sign",
    link: "See how signing works",
    icon: "M4 7a2 2 0 0 1 2-2h11v4M4 7v10a2 2 0 0 0 2 2h14V9H6a2 2 0 0 1-2-2zM16 14h.01",
  },
  {
    title: "Communities",
    tag: "Brand link",
    body: "Share a link with your name on it. Each landed swap pays 5 bps, and half goes to your wallet.",
    chip: "5 bps · split 50/50",
    href: "/docs/brand-link",
    link: "How the link pays",
    icon: "M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM22 19v-1a4 4 0 0 0-3-3.87M16 5.13a3 3 0 0 1 0 5.74",
  },
];

const DEV_POINTS = [
  "Leave out userPublicKey for a quote. Add it for a transaction.",
  "API swaps add no goblock fee.",
  "Errors come back as JSON with a msg field.",
];

const DEV_SNIPPETS: Snippet[] = [
  {
    label: "cURL",
    code: `curl -G "{origin}/api/v1/swap" \\
  -H "x-api-key: $GOBLOCK_API_KEY" \\
  -d inputMint=So11111111111111111111111111111111111111112 \\
  -d outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v \\
  -d amount=10000000 \\
  -d slippageBps=100`,
  },
  {
    label: "TypeScript",
    code: `const params = new URLSearchParams({
  inputMint: SOL_MINT,
  outputMint: USDC_MINT,
  amount: "10000000",
  slippageBps: "100",
  userPublicKey: wallet.publicKey.toBase58(),
});

const res = await fetch(\`{origin}/api/v1/swap?\${params}\`, {
  headers: { "x-api-key": process.env.GOBLOCK_API_KEY },
});
const quote = await res.json();`,
  },
  {
    label: "Response",
    code: `{
  "side": "buy",
  "venue": "Meteora",
  "inAmount": "10000000",
  "outAmount": "1093913",
  "minOutAmount": "1082973",
  "priceImpactPct": "0.0018",
  "feeBps": 0,
  "transaction": "AQAAAAAAAAAAAAAA…",
  "lastValidBlockHeight": 312456789
}`,
  },
];

function sheetGeometry(w: number) {
  const narrow = w < 760;
  const topOuter = narrow ? 112 : Math.min(w * 0.5, 760);
  const topRun = narrow ? 22 : 64;
  const botOuter = narrow ? w * 0.84 : Math.min(w * 0.44, 660);
  const botRun = narrow ? 34 : 60;
  return {
    radius: narrow ? 28 : 40,
    notch: narrow ? 58 : 44,
    drop: narrow ? 40 : 84,
    topOuter,
    topRun,
    botOuter,
    botRun,
    botInner: Math.max(0, botOuter - botRun * 2),
  };
}

function sheetPath(w: number, h: number) {
  const g = sheetGeometry(w);
  const r = g.radius;
  const ta = w / 2 - g.topOuter / 2;
  const tb = ta + g.topRun;
  const tk = g.topRun * 0.55;
  const hs = h - g.drop;
  const ba = w / 2 + g.botOuter / 2;
  const bb = ba - g.botRun;
  const bk = g.botRun * 0.55;
  return [
    `M ${r} 0`,
    `L ${ta} 0`,
    `C ${ta + tk} 0 ${tb - tk} ${g.notch} ${tb} ${g.notch}`,
    `L ${w - tb} ${g.notch}`,
    `C ${w - tb + tk} ${g.notch} ${w - ta - tk} 0 ${w - ta} 0`,
    `L ${w - r} 0`,
    `A ${r} ${r} 0 0 1 ${w} ${r}`,
    `L ${w} ${hs - r}`,
    `A ${r} ${r} 0 0 1 ${w - r} ${hs}`,
    `L ${ba} ${hs}`,
    `C ${ba - bk} ${hs} ${bb + bk} ${h} ${bb} ${h}`,
    `L ${w - bb} ${h}`,
    `C ${w - bb - bk} ${h} ${w - ba + bk} ${hs} ${w - ba} ${hs}`,
    `L ${r} ${hs}`,
    `A ${r} ${r} 0 0 1 0 ${hs - r}`,
    `L 0 ${r}`,
    `A ${r} ${r} 0 0 1 ${r} 0`,
    "Z",
  ].join(" ");
}

const LAND = [
  [0.38, 0.3, 0.11, 0.13],
  [0.46, 0.6, 0.05, 0.15],
  [0.63, 0.26, 0.07, 0.09],
  [0.67, 0.53, 0.07, 0.15],
  [0.81, 0.32, 0.13, 0.14],
  [0.87, 0.68, 0.05, 0.06],
];

function SheetShape({ w, h }: { w: number; h: number }) {
  const id = useId().replace(/:/g, "");
  if (!w || !h) return null;
  const d = sheetPath(w, h);
  return (
    <svg className="j-shape" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0.25" y2="1">
          <stop offset="0" stopColor="#dcf9a4" />
          <stop offset="0.5" stopColor="#b9ec95" />
          <stop offset="1" stopColor="#8dd8c6" />
        </linearGradient>
        <radialGradient id={`${id}-lift`} cx="0.72" cy="0.4" r="0.5">
          <stop offset="0" stopColor="#fff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <pattern id={`${id}-dots`} width="9" height="9" patternUnits="userSpaceOnUse">
          <rect width="3.6" height="3.6" rx="0.8" fill="#121213" fillOpacity="0.11" />
        </pattern>
        <filter id={`${id}-soft`}>
          <feGaussianBlur stdDeviation="14" />
        </filter>
        <mask id={`${id}-land`}>
          <rect width={w} height={h} fill="#000" />
          <g filter={`url(#${id}-soft)`}>
            {LAND.map(([x, y, rx, ry]) => (
              <ellipse key={`${x}-${y}`} cx={x * w} cy={y * h} rx={rx * w} ry={ry * h} fill="#fff" />
            ))}
          </g>
        </mask>
      </defs>
      <path d={d} fill={`url(#${id}-fill)`} />
      <path d={d} fill={`url(#${id}-lift)`} />
      <path d={d} fill={`url(#${id}-dots)`} mask={`url(#${id}-land)`} />
    </svg>
  );
}

export function HomePage() {
  const [tab, setTab] = useState<keyof typeof PANELS>("quote");
  const [best, setBest] = useState(0);
  const { connected, openWallet } = useWalletLite();
  const sheet = useRef<HTMLDivElement>(null);
  const pin = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [back, setBack] = useState(false);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const shape = sheetGeometry(box.w);

  useEffect(() => {
    const node = sheet.current;
    if (!node) return;
    const sync = () => setBox({ w: node.offsetWidth, h: node.offsetHeight });
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setBest((index) => (index + 1) % QUOTES.length), 1600);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const node = pin.current;
    if (!node) return;
    const wide = window.matchMedia("(min-width: 981px)");
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const start = () => node.getBoundingClientRect().top + window.scrollY;
    const at = () => Math.round((window.scrollY - start()) / window.innerHeight);
    let lockUntil = 0;
    let lastWheel = 0;
    let gestureStart = 0;
    let shown = 0;

    const sync = () => {
      const next = wide.matches ? Math.max(0, Math.min(FLOW.length, at())) : 0;
      if (next === shown) return;
      setBack(next < shown);
      shown = next;
      setStep(next);
    };

    const onWheel = (event: WheelEvent) => {
      if (!wide.matches || event.ctrlKey || Math.abs(event.deltaY) < 2) return;
      const top = start();
      const y = window.scrollY;
      const span = FLOW.length * window.innerHeight;
      if (y < top - 4 || y > top + span + 4) return;
      const dir = Math.sign(event.deltaY);
      const next = Math.max(0, Math.min(FLOW.length, at())) + dir;
      if (next < 0 || next > FLOW.length) return;
      event.preventDefault();

      const now = performance.now();
      if (now - lastWheel > 220) gestureStart = now;
      lastWheel = now;
      const fresh = gestureStart === now || now - gestureStart > 1100;
      if (now < lockUntil || !fresh) return;
      gestureStart = now;
      lockUntil = now + 760;
      window.scrollTo({ top: top + next * window.innerHeight, behavior: calm.matches ? "auto" : "smooth" });
    };

    sync();
    window.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      window.removeEventListener("wheel", onWheel);
    };
  }, []);

  return (
    <main className="stage home">
      <div className="j-pin" ref={pin} style={{ ["--flow" as string]: FLOW.length }}>
      <Reveal className="j-hero" motion="hero">
        <div
          className={`j-sheet${step > 0 ? " flow" : ""}`}
          ref={sheet}
          data-m="sheet"
          style={{ ["--bay" as string]: `${shape.botInner}px` }}
        >
          <SheetShape w={box.w} h={box.h} />
          <SiteNav />
          <div className="j-scenes">
          <div className="j-hero-grid" aria-hidden={step > 0}>
            <div className="j-copy">
              <h1>
                <span className="j-line">
                  <span {...m("line", 140)}>The clearer route</span>
                </span>
                <span className="j-line">
                  <span {...m("line", 230)}>on Solana.</span>
                </span>
              </h1>
              <p {...m("rise", 360)}>
                Raydium, Orca, Meteora, and PumpSwap priced in one quote. You sign the better fill in your wallet.
              </p>
              <div className="j-actions" {...m("rise", 460)}>
                <Link className="j-go" href="/trade">
                  Start Trading
                </Link>
                <Link className="j-demo" href="/trade">
                  Open the quote
                  <span>
                    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                      <path d="M7 17 17 7M9 7h8v8" />
                    </svg>
                  </span>
                </Link>
              </div>
            </div>
            <div className="j-side">
              <div className="j-cc" {...m("pop", 300)}>
                <div className="j-cc-tab">
                  <img src="/goblock%20logo%20wordmark.png?v=2" alt="" width={96} height={22} />
                </div>
                <Link className="j-cc-pill" href="/trade">
                  <i>+</i>
                  Live quote
                </Link>
                <div className="j-cc-body">
                  <small>You receive</small>
                  <strong key={best}>
                    {QUOTES[best][1]} <i>USDC</i>
                  </strong>
                  <span className="j-cc-num">0.01 SOL · {QUOTES[best][0]}</span>
                  <div className="j-cc-foot">
                    <span>SOL → USDC</span>
                    <span>{QUOTES[best][2]}</span>
                  </div>
                  <span className="j-cc-cap" aria-hidden="true">
                    <b>
                      <i />
                      <i />
                      <i />
                    </b>
                    <em>SOL</em>
                  </span>
                </div>
              </div>
              <div className="j-facts">
                <div {...m("rise", 520)}>
                  <p>
                    Compared <b>4</b> venues
                  </p>
                  <span className="j-facts-marks">
                    {VENUES.map((venue) => (
                      <img key={venue.name} src={venue.src} alt="" width={16} height={16} />
                    ))}
                  </span>
                </div>
                <div className="j-facts-badge" {...m("rise", 600)}>
                  <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
                    <path d="M9 26c-4-3-6-7-6-11M23 26c4-3 6-7 6-11M6 22l-2 1M26 22l2 1M4 17H2M28 17h2" />
                    <path d="M16 7l7 3v5c0 4.5-3 8-7 9.5C12 23 9 19.5 9 15v-5z" />
                    <path d="M13 15.5l2.2 2.2 4-4.4" />
                  </svg>
                  <p>
                    One signature,
                    <br />
                    on Solana
                  </p>
                </div>
              </div>
            </div>
          </div>
          <FlowStage step={step} back={back} />
          </div>
          <div className="j-sheet-foot">
            <p {...m("rise", 620)}>Trade from your wallet</p>
            <div className="j-stores" {...m("rise", 700)}>
              <button type="button" onClick={() => openWallet()}>
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                  <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3M4 7.5V17a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H6.5A2.5 2.5 0 0 1 4 7.5zM16 13.5h1" />
                </svg>
                {connected ? "Wallet connected" : "Connect Wallet"}
              </button>
              <Link href="/trade">
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                  <path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />
                </svg>
                Start Trading
              </Link>
            </div>
          </div>
        </div>
        <div className="j-logos" style={{ ["--bay" as string]: `${shape.botInner}px` }}>
          <div className="j-logos-row">
            <span className="j-logo-pair">
              {[{ name: "Pump.fun", src: "/brands/pumpfun.png" }, ...VENUES.slice(0, 2)].map((venue, index) => (
                <span key={venue.name} {...m("rise", 760 + (2 - index) * 70)}>
                  <img src={venue.src} alt="" width={26} height={26} />
                  {venue.name}
                </span>
              ))}
            </span>
            <span />
            <span className="j-logo-pair">
              {[...VENUES.slice(2), { name: "Bonk.fun", src: "/brands/bonkfun.png" }].map((venue, index) => (
                <span key={venue.name} {...m("rise", 760 + index * 70)}>
                  <img src={venue.src} alt="" width={26} height={26} />
                  {venue.name}
                </span>
              ))}
            </span>
          </div>
          <div className="j-logos-mid">
            {[
              ["Solana", "/brands/solana.png"],
              ["Solscan", "/brands/solscan.png"],
              ["Reown", "/brands/reown.png"],
            ].map(([name, src], index) => (
              <span key={name} className={name === "Reown" ? "dark" : undefined} {...m("rise", 900 + index * 70)}>
                <img src={src} alt="" width={26} height={26} />
                {name}
              </span>
            ))}
          </div>
        </div>
      </Reveal>
      </div>

      <Reveal className="s-sec s-flow-m" motion="flow">
        <div className="j-wrap">
          <div className="s-head">
            <span className="s-kick" {...m("rise")}>How it runs</span>
            <h2 {...m("rise", 80)}>From the quote to the signature.</h2>
          </div>
          <FlowList />
        </div>
      </Reveal>

      <Reveal className="s-sec" motion="venues">
        <div className="j-wrap">
          <div className="s-head split">
            <div>
              <span className="s-kick" {...m("rise")}>Venues</span>
              <h2 {...m("rise", 80)}>The venues behind the quote.</h2>
            </div>
            <p className="s-sub" {...m("rise", 160)}>
              One list. The better output is the row that stays on the card.
            </p>
          </div>
          <div className="s-folders">
            {VENUES.map((venue, index) => (
              <article className="s-folder" key={venue.name} data-m="spread" style={{ ["--i" as string]: index }}>
                <span className="s-folder-tab">
                  <img src={venue.src} alt="" width={22} height={22} />
                  {venue.name}
                </span>
                <div className="s-folder-body">
                  <span className="s-folder-no">{String(index + 1).padStart(2, "0")}</span>
                  <p>{venue.body}</p>
                  <Link href="/trade">
                    Trade
                    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                      <path d="M7 17 17 7M9 7h8v8" />
                    </svg>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </Reveal>

      <Reveal className="s-sec" motion="segments">
        <div className="j-wrap">
          <div className="s-head split">
            <div>
              <span className="s-kick" {...m("rise")}>Who it&apos;s for</span>
              <h2 {...m("rise", 80)}>One router. Four ways in.</h2>
            </div>
            <p className="s-sub" {...m("rise", 160)}>
              The same quote powers the Trade page, your bot, your wallet, and a link you share.
            </p>
          </div>
          <div className="s-seg">
            {SEGMENTS.map((item, index) => (
              <article
                key={item.title}
                className={index === 1 ? "s-seg-card lit" : "s-seg-card"}
                data-m="lift"
                style={{ ["--i" as string]: index }}
              >
                <div className="s-seg-top">
                  <span className="s-seg-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="22" height="22">
                      <path d={item.icon} />
                    </svg>
                  </span>
                  <span className="s-seg-tag">{item.tag}</span>
                </div>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
                <code className="s-seg-chip">{item.chip}</code>
                <Link className="s-seg-link" href={item.href}>
                  {item.link}
                  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                    <path d="M7 17 17 7M9 7h8v8" />
                  </svg>
                </Link>
              </article>
            ))}
          </div>
        </div>
      </Reveal>

      <Reveal className="s-sec" motion="why">
        <div className="j-wrap">
          <div className="s-why" {...m("sheet")}>
            <div className="s-why-head">
              <span className="s-kick dark" {...m("rise", 140)}>Why goblock</span>
              <h2 {...m("rise", 220)}>The quote, the floor, and the signature stay in one place.</h2>
            </div>
            <ol className="s-why-list">
              {REASONS.map(([title, body], index) => (
                <li key={title} data-m="lift" style={{ ["--i" as string]: index }}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <b>{title}</b>
                  <p>{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Reveal>

      <Reveal className="s-sec" motion="peek">
        <div className="j-wrap s-peek">
          <div>
            <span className="s-kick" {...m("left")}>Before you sign</span>
            <h2 {...m("left", 80)}>See it before you sign.</h2>
            <p className="s-sub" {...m("left", 160)}>
              The card, the route, and the receipt are the same swap.
            </p>
            <div className="s-tabs" role="tablist" aria-label="Swap details">
              {TABS.map(([id, label, note], index) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  className={tab === id ? "on" : undefined}
                  onClick={() => setTab(id)}
                  {...m("left", 240 + index * 80)}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <b>{label}</b>
                  <small>{note}</small>
                </button>
              ))}
            </div>
          </div>
          <div className="s-term" {...m("right", 200)}>
            <span className="s-term-tab">
              <i />
              {TABS.find(([id]) => id === tab)?.[1]}
            </span>
            <div className="s-term-body" key={tab}>
              {PANELS[tab].map((line, row) => {
                const [key, ...rest] = line.trim().split(/\s+/);
                return (
                  <div className={`s-row${row === 0 ? " head" : ""}`} key={line} style={{ ["--r" as string]: row }}>
                    <span>{key}</span>
                    <b>{rest.join(" ")}</b>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Reveal>

      <Reveal className="s-sec s-band" motion="sign">
        <div className="j-wrap s-sign">
          <div className="s-ticket" {...m("left", 100)}>
            <div className="s-ticket-top">
              <img src="/goblock%20logo%20wordmark.png?v=2" alt="" width={96} height={22} />
              <span>Receipt</span>
            </div>
            <span className="s-ticket-mark" aria-hidden="true" {...m("pop", 460)}>
              <svg viewBox="0 0 24 24" width="26" height="26">
                <path d="M5 12.5 10 17.5 19 7" />
              </svg>
            </span>
            <strong>Swap ready</strong>
            <dl>
              <div>
                <dt>You pay</dt>
                <dd>0.01 SOL</dd>
              </div>
              <div>
                <dt>You receive</dt>
                <dd>1.093913 USDC</dd>
              </div>
              <div>
                <dt>Venue</dt>
                <dd>Meteora</dd>
              </div>
              <div>
                <dt>Impact</dt>
                <dd>0.18%</dd>
              </div>
            </dl>
            <span className="s-ticket-foot">Signed once · on Solana</span>
          </div>
          <div>
            <span className="s-kick" {...m("right")}>One signature</span>
            <h2 {...m("right", 80)}>The wallet asks once.</h2>
            <p className="s-sub" {...m("right", 160)}>
              The receipt keeps what you signed.
            </p>
            <ul className="s-checks">
              {CHECKS.map((text, index) => (
                <li key={text} {...m("right", 240 + index * 80)}>
                  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                    <path d="M5 12.5 10 17.5 19 7" />
                  </svg>
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Reveal>

      <Reveal className="s-sec" motion="dev">
        <div className="j-wrap s-dev">
          <div className="s-dev-copy">
            <span className="s-kick" {...m("left")}>Developers</span>
            <h2 {...m("left", 80)}>Welcome, developer.</h2>
            <p className="s-sub" {...m("left", 160)}>
              One request compares every venue and hands back a transaction your user signs. Your key goes in one header.
            </p>
            <div className="s-key" {...m("left", 240)}>
              <span className="s-key-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path d="M15 7a4 4 0 1 1-3.87 5H9v2H7v2H4v-3l5.13-5.13A4 4 0 0 1 15 7zM16 9v.01" />
                </svg>
              </span>
              <div>
                <small>API key</small>
                <code>x-api-key: ••••••••••••••••</code>
              </div>
              <Link href="/pricing">Get a key</Link>
            </div>
            <ul className="s-checks">
              {DEV_POINTS.map((text, index) => (
                <li key={text} {...m("left", 320 + index * 80)}>
                  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                    <path d="M5 12.5 10 17.5 19 7" />
                  </svg>
                  {text}
                </li>
              ))}
            </ul>
            <div className="p-actions" {...m("left", 560)}>
              <Link className="p-btn" href="/pricing">
                Get API Key
              </Link>
              <Link className="p-btn line" href="/docs">
                Read the Docs
              </Link>
            </div>
          </div>
          <div {...m("right", 200)}>
            <CodeBlock snippets={DEV_SNIPPETS} />
          </div>
        </div>
      </Reveal>

      <Reveal className="s-sec" motion="steps">
        <div className="j-wrap">
          <div className="s-head center">
            <span className="s-kick" {...m("rise")}>The swap</span>
            <h2 {...m("rise", 80)}>Built for the swap.</h2>
            <p className="s-sub" {...m("rise", 160)}>
              Compare, read, sign. Nothing else sits between the quote and the wallet.
            </p>
          </div>
          <ol className="s-stairs">
            {STEPS.map(([title, body], index) => (
              <li key={title} data-m="tilt" style={{ ["--i" as string]: index }}>
                <span className="s-num">{String(index + 1).padStart(2, "0")}</span>
                <b>{title}</b>
                <p>{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </Reveal>

      <Reveal className="s-sec s-end" motion="ready">
        <div className="j-wrap">
          <div className="s-ready" {...m("sheet")}>
            <img className="s-ready-mark" src="/goblock-mark.png" alt="" width={420} height={420} loading="lazy" decoding="async" />
            <span className="s-kick dark" {...m("rise", 140)}>Start here</span>
            <h2 {...m("rise", 220)}>Ready to swap?</h2>
            <p {...m("rise", 300)}>The better fill, signed in your wallet.</p>
            <div className="s-ready-actions" {...m("rise", 380)}>
              <Link className="j-go" href="/trade">
                Start Trading
              </Link>
              <button type="button" className="s-ghost" onClick={() => openWallet()}>
                {connected ? "Wallet connected" : "Connect Wallet"}
              </button>
            </div>
          </div>
        </div>
      </Reveal>

      <SiteFoot />
    </main>
  );
}
