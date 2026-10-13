"use client";

import Link from "next/link";
import { CodeBlock } from "../../code-block";
import { QUOTE_SNIPPETS, SIGN_SNIPPETS } from "../../docs/parts";
import { Icon, type IconName } from "./icons";
import { Card, PageHead, useLoaded } from "./shell";

function withKey(key: string) {
  const [curl, ts, py] = QUOTE_SNIPPETS;
  return [
    { label: curl.label, code: `export GOBLOCK_API_KEY="${key}"\n\n${curl.code}` },
    { label: ts.label, code: `// .env\n// GOBLOCK_API_KEY=${key}\n\n${ts.code}` },
    { label: py.label, code: `# export GOBLOCK_API_KEY="${key}"\n\n${py.code}` },
  ];
}

const DOCS: [string, string, string, IconName][] = [
  ["/docs/swap", "Quote a swap", "Every query parameter the endpoint takes.", "quickstart"],
  ["/docs/response", "Response", "What each field of a quote means.", "docs"],
  ["/docs/errors", "Errors", "Status codes and how to handle them.", "shield"],
  ["/docs/brand-link", "Brand link", "Share a link that pays you 2.5 bps.", "earnings"],
];

export function QuickstartView() {
  const { overview, created, placeholder } = useLoaded();
  if (!overview) return placeholder;
  const hasKey = overview.keys.some((key) => !key.revokedAt);
  const used = overview.usage.some((day) => day.requests > 0);

  const steps = [
    { done: hasKey, title: "Create a key", body: "One key per app keeps usage readable." },
    { done: used, title: "Quote a swap", body: "Call GET /api/v1/swap with the x-api-key header." },
    { done: false, title: "Sign and send", body: "Add userPublicKey and let the user's wallet sign." },
  ];

  return (
    <>
      <PageHead title="Quickstart" sub="From a new key to a signed swap in three steps.">
        <Link className="p-btn line" href="/dashboard/playground">
          Open Playground
          <Icon name="play" size={16} />
        </Link>
        <Link className="p-btn line" href="/docs/quickstart">
          Full Guide
          <Icon name="arrow" size={16} />
        </Link>
      </PageHead>

      <ol className="ds-timeline">
        {steps.map((step, index) => (
          <li key={step.title} className={step.done ? "done" : undefined}>
            <div className="ds-timeline-body">
              <span>{step.done ? <Icon name="check" size={14} /> : index + 1}</span>
              <em>{step.done ? "Done" : `Step ${index + 1}`}</em>
              <b>{step.title}</b>
              <small>{step.body}</small>
            </div>
          </li>
        ))}
      </ol>

      <Card
        plain
        title="1. Request a quote"
        sub={created ? "Your new key is filled in." : "Replace YOUR_API_KEY with a key from API Keys."}
        action={
          hasKey ? null : (
            <Link className="k-link" href="/dashboard/keys#create">
              Create a key
            </Link>
          )
        }
      >
        <p className="ds-text">
          This asks for 0.01 SOL into USDC. Amounts are in atomic units, so 10000000 lamports is 0.01 SOL.
        </p>
        <CodeBlock className="slim" snippets={withKey(created?.key ?? "YOUR_API_KEY")} />
      </Card>

      <Card plain title="2. Sign and send" sub="Request the quote with userPublicKey set">
        <CodeBlock className="slim" snippets={SIGN_SNIPPETS} />
      </Card>

      <div className="ds-section-head">
        <b>Go deeper</b>
        <small>The full reference lives in the docs.</small>
      </div>
      <ul className="ds-links">
        {DOCS.map(([href, title, body, icon]) => (
          <li key={href}>
            <Link href={href} className="ds-links-body">
              <span>
                <Icon name={icon} />
              </span>
              <b>{title}</b>
              <small>{body}</small>
              <em>
                Read
                <Icon name="arrow" size={14} />
              </em>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
