import Link from "next/link";
import type { ReactNode } from "react";

export const SOL = "So11111111111111111111111111111111111111112";
export const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export const QUOTE_SNIPPETS = [
  {
    label: "cURL",
    code: `curl -G "{origin}/api/v1/swap" \\
  -H "x-api-key: $GOBLOCK_API_KEY" \\
  -d inputMint=${SOL} \\
  -d outputMint=${USDC} \\
  -d amount=10000000 \\
  -d slippageBps=100`,
  },
  {
    label: "TypeScript",
    code: `const params = new URLSearchParams({
  inputMint: "${SOL}",
  outputMint: "${USDC}",
  amount: "10000000",
  slippageBps: "100",
});

const res = await fetch(\`{origin}/api/v1/swap?\${params}\`, {
  headers: { "x-api-key": process.env.GOBLOCK_API_KEY },
});
if (!res.ok) throw new Error((await res.json()).msg);
const quote = await res.json();`,
  },
  {
    label: "Python",
    code: `import os
import requests

res = requests.get(
    "{origin}/api/v1/swap",
    headers={"x-api-key": os.environ["GOBLOCK_API_KEY"]},
    params={
        "inputMint": "${SOL}",
        "outputMint": "${USDC}",
        "amount": "10000000",
        "slippageBps": 100,
    },
)
quote = res.json()`,
  },
];

export const SIGN_SNIPPETS = [
  {
    label: "TypeScript",
    code: `import { Connection, VersionedTransaction } from "@solana/web3.js";

// Request the quote with userPublicKey set.
const bytes = Uint8Array.from(atob(quote.transaction), (c) => c.charCodeAt(0));
const transaction = VersionedTransaction.deserialize(bytes);

const signature = await wallet.sendTransaction(transaction, connection);
await connection.confirmTransaction(
  {
    signature,
    blockhash: transaction.message.recentBlockhash,
    lastValidBlockHeight: quote.lastValidBlockHeight,
  },
  "confirmed",
);`,
  },
];

export function Info({ children }: { children: ReactNode }) {
  return (
    <div className="d-call">
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5M12 8v.01" />
      </svg>
      <div>{children}</div>
    </div>
  );
}

export function Endpoint({
  path,
  method = "GET",
  note = "x-api-key required",
}: {
  path: string;
  method?: string;
  note?: string;
}) {
  return (
    <div className="d-endpoint">
      <span className="d-method">{method}</span>
      {path}
      <small>{note}</small>
    </div>
  );
}

export function Table({ head, rows }: { head: string[]; rows: [string, ReactNode, ReactNode?][] }) {
  const two = head.length === 2;
  const row = two ? "d-row two" : "d-row";
  return (
    <div className="d-table">
      <div className={`${row} head`}>
        {head.map((cell) => (
          <span key={cell}>{cell}</span>
        ))}
      </div>
      {rows.map(([name, second, third]) => (
        <div className={row} key={name}>
          <code>{name}</code>
          {two ? <span>{second}</span> : <span className="d-type">{second}</span>}
          {two ? null : <span>{third}</span>}
        </div>
      ))}
    </div>
  );
}

export function Sec({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="d-sec" id={id}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export type Card = { href: string; title: string; body: string; icon: ReactNode };

export function Cards({ items }: { items: Card[] }) {
  return (
    <div className="d-cards">
      {items.map((card) => (
        <Link className="d-card" href={card.href} key={card.href}>
          <svg className="d-card-arrow" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M7 17 17 7M9 7h8v8" />
          </svg>
          <span className="d-card-icon">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              {card.icon}
            </svg>
          </span>
          <b>{card.title}</b>
          <p>{card.body}</p>
        </Link>
      ))}
    </div>
  );
}

export const ICONS = {
  swap: <path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />,
  send: <path d="m22 2-7 20-4-9-9-4 20-7ZM22 2 11 13" />,
  key: (
    <>
      <circle cx="7.5" cy="15.5" r="4.5" />
      <path d="m10.7 12.3 9.8-9.8M17 6l3 3M14.5 8.5l2 2" />
    </>
  ),
  code: <path d="m16 18 6-6-6-6M8 6l-6 6 6 6" />,
  route: (
    <>
      <circle cx="6" cy="19" r="3" />
      <circle cx="18" cy="5" r="3" />
      <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
    </>
  ),
  tag: (
    <>
      <path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4Z" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </>
  ),
  layers: <path d="m12 2 10 5-10 5L2 7l10-5ZM2 12l10 5 10-5M2 17l10 5 10-5" />,
  alert: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4M12 16h.01" />
    </>
  ),
  doc: <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6ZM14 2v6h6M8 13h8M8 17h5" />,
};
