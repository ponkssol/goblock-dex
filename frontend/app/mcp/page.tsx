import Link from "next/link";
import { CLAUDE_RAYS } from "../claude";
import { m } from "../motion";
import { Reveal } from "../reveal";
import { SiteFoot } from "../site-foot";
import { SiteNav } from "../site-nav";
import { pageMeta } from "../site";
import { PUBLIC_SKILL } from "@goblock/shared/skill";
import { McpConsole } from "./mcp-console";
import { SkillFile } from "./skill-file";
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

const TOOL_CARDS = [
  {
    id: "search_tokens",
    body: "Find a token by name, symbol, or mint.",
    input: `{ "query": "BONK" }`,
  },
  {
    id: "get_price",
    body: "Price of a token in SOL and USD.",
    input: `{ "token": "SOL" }`,
  },
  {
    id: "get_quote",
    body: "Best route across five venues for an amount.",
    input: `{ "from": "SOL", "to": "USDC", "amount": "0.1" }`,
  },
  {
    id: "build_swap",
    body: "An unsigned transaction for the wallet to approve. goblock never signs for you.",
    input: `{ "from": "SOL", "to": "USDC", "amount": "0.1", "wallet": "7xKX…" }`,
  },
  {
    id: "get_receipt",
    body: "Graduated or on the curve, creator fee, mayhem, and cashback for a coin.",
    input: `{ "token": "9BB6…pump" }`,
  },
  {
    id: "get_balance",
    body: "SOL and token balances for a wallet, read only.",
    input: `{ "wallet": "7xKX…9fQa" }`,
  },
];

const PROMPTS = [
  ["swap", "Swap 0.1 SOL to USDC with 1% slippage."],
  ["price", "What does 1 SOL buy of BONK right now, and which venue wins?"],
  ["receipt", "Is this coin still on the bonding curve? 9BB6…pump"],
  ["sell", "Build a sell of half my USDC to SOL for wallet 7xKX…9fQa."],
];

const STEPS = [
  ["Copy the block", "One short config for the agent you use."],
  ["Paste it in", "Drop it in that agent's MCP file, then restart the agent."],
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
                MCP · Live
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
              <p className="m-endpoint" {...m("rise", 260)}>
                <code>POST /api/mcp</code>
                Mainnet. The agent quotes. Your wallet signs.
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
          <div className="s-head m-install-head">
            <span className="s-kick" {...m("rise")}>Install</span>
            <h2 {...m("rise", 80)}>Add the server.</h2>
            <p className="s-sub" {...m("rise", 140)}>
              Pick the agent. Copy the block into its MCP config. Replace the key with one from the dashboard.
            </p>
          </div>
          <div {...m("rise", 200)}>
            <McpConsole />
          </div>
        </div>
      </Reveal>

      <Reveal className="s-sec" motion="skill" id="skill">
        <div className="j-wrap">
          <div className="s-head split">
            <div>
              <span className="s-kick" {...m("rise")}>Skill</span>
              <h2 {...m("rise", 80)}>What the agent is told.</h2>
            </div>
            <p className="s-sub" {...m("rise", 160)}>
              This is the file the agent reads at <code>goblock://skill</code> on a default connection. Copy it, or download <code>goblock-skill.md</code>.
            </p>
          </div>
          <div {...m("rise", 200)}>
            <SkillFile text={PUBLIC_SKILL} />
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
              Once goblock is in the agent&apos;s MCP list, ask in plain words. The same ideas are available as MCP
              prompts named swap, price, receipt, and sell.
            </p>
          </div>
          <ul className="m-prompts">
            {PROMPTS.map(([name, prompt], index) => (
              <li key={name} data-m="lift" style={{ ["--i" as string]: index % 2 }}>
                <code>{name}</code>
                <span>{prompt}</span>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>

      <SiteFoot />
    </main>
  );
}
