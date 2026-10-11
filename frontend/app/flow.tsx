"use client";

import "./flow.css";

export const FLOW = [
  {
    label: "Request",
    short: "Pair, amount, slippage",
    title: "You ask for a quote.",
    body: "Pick the pair and the amount. The slippage you set becomes the floor the swap cannot go under.",
    icon: "M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4",
  },
  {
    label: "Probe",
    short: "Four venues at once",
    title: "Every venue is asked at once.",
    body: "Raydium, Orca, Meteora, and PumpSwap are priced in parallel. A venue that runs past its time budget is left out.",
    icon: "M12 12h.01M8.5 15.5a5 5 0 0 1 0-7M15.5 8.5a5 5 0 0 1 0 7M5.6 18.4a9 9 0 0 1 0-12.8M18.4 5.6a9 9 0 0 1 0 12.8",
  },
  {
    label: "Compare",
    short: "Direct, hop, split",
    title: "The routes are compared.",
    body: "A direct fill, a hop through SOL or USDC, and a split across the top two venues. The highest output stays.",
    icon: "M5 20V11M12 20V4M19 20v-6M3 20h18",
  },
  {
    label: "Build",
    short: "One transaction",
    title: "One transaction is built.",
    body: "The winning route becomes swap instructions, with the minimum received written into the transaction itself.",
    icon: "M12 3 21 8l-9 5-9-5 9-5zM3 13l9 5 9-5M3 17l9 5 9-5",
  },
  {
    label: "Sign",
    short: "Your wallet",
    title: "Your wallet signs once.",
    body: "The transaction opens in your wallet. goblock never holds the tokens or the keys.",
    icon: "M4 20h4L19 9a2.83 2.83 0 0 0-4-4L4 16v4zM13.5 6.5l4 4M14 20h6",
  },
  {
    label: "Settle",
    short: "On Solana",
    title: "It settles on Solana.",
    body: "The swap lands on-chain, and the receipt opens the signature on Solscan.",
    icon: "M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3zM8.5 12l2.5 2.5 4.5-5",
  },
];

const PROBES = [
  ["Raydium", "/venues/raydium.svg"],
  ["Orca", "/venues/orca.svg"],
  ["Meteora", "/venues/meteora.svg"],
  ["PumpSwap", "/venues/pumpswap.svg"],
];

function Icon({ d, size = 22 }: { d: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function Detail({ index }: { index: number }) {
  if (index === 0) {
    return (
      <div className="f-detail f-request">
        <div className="f-field">
          <small>You pay</small>
          <strong>0.01</strong>
          <span className="f-token">
            <i className="sol" />
            SOL
          </span>
        </div>
        <div className="f-field">
          <small>You receive</small>
          <strong className="dim">—</strong>
          <span className="f-token">
            <i className="usdc" />
            USDC
          </span>
        </div>
        <div className="f-chips">
          <span>Slippage 1%</span>
          <span>Floor = minimum received</span>
        </div>
      </div>
    );
  }
  if (index === 1) {
    return (
      <div className="f-detail f-probe">
        <small className="f-cap">Quoting in parallel</small>
        {PROBES.map(([name, src], row) => (
          <div className="f-probe-row" key={name} style={{ ["--r" as string]: row }}>
            <img src={src} alt="" width={22} height={22} />
            <span>{name}</span>
            <b>
              <i />
            </b>
            <em>quoted</em>
          </div>
        ))}
      </div>
    );
  }
  if (index === 2) {
    return (
      <div className="f-detail f-compare">
        <small className="f-cap">Candidate routes</small>
        {[
          ["Direct", "Best single venue"],
          ["Two hops", "Through SOL or USDC"],
          ["Split", "50/50 or 70/30 across the top two"],
        ].map(([name, note], row) => (
          <div className={`f-route${row === 0 ? " win" : ""}`} key={name} style={{ ["--r" as string]: row }}>
            <span>
              <b>{name}</b>
              <small>{note}</small>
            </span>
            <em>{row === 0 ? "Highest output" : "Checked"}</em>
          </div>
        ))}
      </div>
    );
  }
  if (index === 3) {
    return (
      <div className="f-detail f-build">
        <small className="f-cap">Transaction</small>
        {[
          ["Swap instructions", "from the winning route"],
          ["Lookup tables", "kept in one message"],
          ["Minimum received", "1.092000 USDC"],
          ["Site fee", "0 on this page"],
        ].map(([name, value], row) => (
          <div className="f-line" key={name} style={{ ["--r" as string]: row }}>
            <span>{name}</span>
            <b>{value}</b>
          </div>
        ))}
      </div>
    );
  }
  if (index === 4) {
    return (
      <div className="f-detail f-sign">
        <div className="f-wallet">
          <span className="f-wallet-top">
            <img src="/goblock%20logo%20wordmark.png?v=2" alt="" width={84} height={20} />
            <small>wants you to sign</small>
          </span>
          <strong>0.01 SOL → USDC</strong>
          <small>Minimum received 1.092000 USDC</small>
          <span className="f-approve">Approve</span>
        </div>
        <p className="f-keys">
          <Icon d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3z" size={18} />
          goblock never holds your keys
        </p>
      </div>
    );
  }
  return (
    <div className="f-detail f-settle">
      <svg className="f-check" viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">
        <circle cx="32" cy="32" r="27" />
        <path d="M20 33.5 28 41.5 44.5 24" />
      </svg>
      <strong>Confirmed on Solana</strong>
      <small>0.01 SOL → 1.093913 USDC · Meteora</small>
      <span className="f-solscan">Signature on Solscan ↗</span>
    </div>
  );
}

export function FlowStage({ step, back }: { step: number; back: boolean }) {
  const active = Math.max(0, step - 1);
  const item = FLOW[active];
  const progress = FLOW.length > 1 ? active / (FLOW.length - 1) : 0;

  return (
    <div className={`f-stage${back ? " back" : ""}`} aria-hidden={step === 0}>
      <div className="f-top">
        <div className="f-copy" key={`copy-${active}`}>
          <span className="f-kicker">
            How goblock runs a swap
            <b>
              {String(active + 1).padStart(2, "0")} / {String(FLOW.length).padStart(2, "0")}
            </b>
          </span>
          <h2>{item.title}</h2>
          <p>{item.body}</p>
        </div>
        <div className="f-card" key={`card-${active}`}>
          <span className="f-card-tab">
            <Icon d={item.icon} size={18} />
            {item.label}
          </span>
          <Detail index={active} />
        </div>
      </div>

      <ol className="f-track" style={{ ["--p" as string]: progress }}>
        <span className="f-rail" aria-hidden="true">
          <i />
        </span>
        {FLOW.map((node, index) => (
          <li
            key={node.label}
            className={index < active ? "done" : index === active ? "now" : undefined}
            style={{ ["--n" as string]: index }}
          >
            <span className="f-node">
              {index < active ? <Icon d="M5 12.5 10 17.5 19 7" /> : <Icon d={node.icon} />}
            </span>
            <b>{node.label}</b>
            <small>{node.short}</small>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function FlowList() {
  return (
    <ol className="f-list">
      {FLOW.map((node, index) => (
        <li key={node.label} data-m="rise" style={{ ["--d" as string]: `${index * 90}ms` }}>
          <span className="f-node">
            <Icon d={node.icon} />
          </span>
          <div>
            <small>
              {String(index + 1).padStart(2, "0")} · {node.label}
            </small>
            <b>{node.title}</b>
            <p>{node.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
