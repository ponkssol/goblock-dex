import Link from "next/link";
import { CLAUDE_RAYS } from "../claude";
import { m } from "../motion";
import { Reveal } from "../reveal";
import { SiteFoot } from "../site-foot";
import { SiteNav } from "../site-nav";
import { pageMeta } from "../site";
import { McpConsole } from "./mcp-console";
import "../home.css";
import "../sections.css";
import "../pages.css";

export const metadata = pageMeta({
  title: "MCP · goblock",
  description:
    "Connect Claude, Cursor, Windsurf, VS Code, and Codex to goblock over MCP. Quote, route, and build a Solana swap from your AI agent.",
  path: "/mcp",
  keywords: ["Solana MCP server", "MCP swap", "Claude MCP", "Cursor MCP", "AI agent Solana"],
});

const AGENTS = ["Claude", "Cursor", "Windsurf", "VS Code", "Codex"];

const TOOL_CARDS = [
  {
    id: "search_tokens",
    body: "Find a token by name, symbol, or mint.",
    input: `{ "query": "BONK" }`,
  },
  {
    id: "get_price",
    body: "Price of a token in SOL and USD.",
    input: `{ "mint": "DezX…B263" }`,
  },
  {
    id: "get_quote",
    body: "Best route across five venues for an amount.",
    input: `{ "from": "SOL", "to": "USDC", "amount": "0.1" }`,
  },
  {
    id: "build_swap",
    body: "A transaction for the wallet to sign. goblock never signs for you.",
    input: `{ "quoteId": "q_01…", "wallet": "7xKX…9fQa" }`,
  },
  {
    id: "get_receipt",
    body: "Graduated or on the curve, creator fee, mayhem, and cashback for a coin.",
    input: `{ "mint": "9BB6…pump" }`,
  },
  {
    id: "get_balance",
    body: "SOL and token balances for a wallet, read only.",
    input: `{ "wallet": "7xKX…9fQa" }`,
  },
];

const PROMPTS = [
  "Swap 0.1 SOL to USDC with 1% slippage.",
  "What does 1 SOL buy of BONK right now, and which venue wins?",
  "Is this coin still on the bonding curve? 9BB6…pump",
  "Build a sell of half my USDC to SOL for wallet 7xKX…9fQa.",
];

const STEPS = [
  ["Pick your settings", "Network, slippage, and which tools the agent may call."],
  ["Copy the config", "One block for Cursor, Claude, Windsurf, VS Code, or Codex."],
  ["Ask in plain words", "The agent quotes, then hands your wallet a transaction to approve."],
];

export default function McpPage() {
  return (
    <main className="stage home subpage">
      <SiteNav />

      <Reveal className="m-top" motion="mcp">
        <div className="j-wrap">
          <section className="m-hero" {...m("rise")}>
            <img className="m-hero-mark" src="/goblock-mark.png" alt="" aria-hidden="true" />

            <div className="j-copy">
              <span className="m-chip" {...m("rise", 80)}>
                <i />
                MCP · Preview
              </span>
              <h1 {...m("rise", 140)}>
                Swap from your
                <br />
                AI agent.
              </h1>
              <p {...m("rise", 220)}>
                Connect Claude, Cursor, and other agents to goblock over MCP. Quote, route, and build a swap without
                leaving the chat.
              </p>
              <div className="j-actions" {...m("rise", 300)}>
                <a className="j-go" href="#setup">
                  Set Up MCP
                </a>
                <Link className="j-demo" href="/docs">
                  Read the Docs
                  <span>
                    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                      <path d="M7 17 17 7M9 7h8v8" />
                    </svg>
                  </span>
                </Link>
              </div>
              <div className="m-works" {...m("rise", 380)}>
                <small>Works with</small>
                {AGENTS.map((agent) => (
                  <span key={agent}>{agent}</span>
                ))}
              </div>
            </div>

            <div className="m-chat" {...m("pop", 260)}>
              <div className="m-chat-tab">
                <svg viewBox="-12 -12 24 24" width="20" height="20" aria-hidden="true">
                  <path d={CLAUDE_RAYS} />
                </svg>
                Claude
                <em>goblock MCP</em>
              </div>
              <div className="m-chat-body">
                <p className="m-msg you">Swap 0.1 SOL to USDC with 1% slippage.</p>
                <div className="m-call">
                  <code>get_quote</code>
                  <span>goblock</span>
                  <b aria-label="Done">
                    <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
                      <path d="M5 12.5 10 17.5 19 7" />
                    </svg>
                  </b>
                </div>
                <p className="m-msg bot">
                  Best route is <b>Meteora</b>. 0.1 SOL gets about <b>10.94 USDC</b>, and at least 10.83 after 1%
                  slippage.
                </p>
                <div className="m-call">
                  <code>build_swap</code>
                  <span>goblock</span>
                  <b aria-label="Done">
                    <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
                      <path d="M5 12.5 10 17.5 19 7" />
                    </svg>
                  </b>
                </div>
                <div className="m-approve">
                  <span>
                    <small>Transaction ready</small>
                    SOL → USDC
                  </span>
                  <i>Approve in Wallet</i>
                </div>
              </div>
            </div>
          </section>

          <ol className="m-steps" {...m("rise", 300)}>
            {STEPS.map(([title, body]) => (
              <li key={title}>
                <b>{title}</b>
                <span>{body}</span>
              </li>
            ))}
          </ol>
        </div>
      </Reveal>

      <Reveal className="s-sec" motion="setup" id="setup">
        <div className="j-wrap">
          <div className="s-head split">
            <div>
              <span className="s-kick" {...m("rise")}>Setup</span>
              <h2 {...m("rise", 80)}>Settings in, config out.</h2>
            </div>
            <p className="s-sub" {...m("rise", 160)}>
              Every change on the left rewrites the config on the right. The MCP server is in preview, so these values
              are examples for now.
            </p>
          </div>
          <div {...m("rise", 200)}>
            <McpConsole />
          </div>
        </div>
      </Reveal>

      <Reveal className="s-sec" motion="tools">
        <div className="j-wrap">
          <div className="s-head center">
            <span className="s-kick" {...m("rise")}>Tools</span>
            <h2 {...m("rise", 80)}>What the agent can call.</h2>
          </div>
          <ul className="m-cards">
            {TOOL_CARDS.map((tool, index) => (
              <li key={tool.id} data-m="lift" style={{ ["--i" as string]: index % 3 }}>
                <code className="m-name">{tool.id}</code>
                <p>{tool.body}</p>
                <pre>{tool.input}</pre>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>

      <Reveal className="s-sec" motion="prompts">
        <div className="j-wrap">
          <div className="s-head split">
            <div>
              <span className="s-kick" {...m("rise")}>Try it</span>
              <h2 {...m("rise", 80)}>Ask like you would ask a trader.</h2>
            </div>
            <p className="s-sub" {...m("rise", 160)}>
              Once goblock is in the agent&apos;s MCP list, these work as written.
            </p>
          </div>
          <ul className="m-prompts">
            {PROMPTS.map((prompt, index) => (
              <li key={prompt} data-m="lift" style={{ ["--i" as string]: index % 2 }}>
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                {prompt}
              </li>
            ))}
          </ul>
        </div>
      </Reveal>

      <SiteFoot />
    </main>
  );
}
