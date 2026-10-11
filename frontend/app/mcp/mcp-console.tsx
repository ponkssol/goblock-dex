"use client";

import { useMemo, useState } from "react";
import { CodeBlock, type Snippet } from "../code-block";

export const TOOLS = [
  { id: "search_tokens", label: "Search tokens" },
  { id: "get_price", label: "Get price" },
  { id: "get_quote", label: "Get quote" },
  { id: "build_swap", label: "Build swap" },
  { id: "get_receipt", label: "Coin receipt" },
  { id: "get_balance", label: "Wallet balance" },
];

const NETWORKS = ["mainnet", "devnet"] as const;
const SLIPPAGE = [50, 100, 200];
const KEY_HINT = "YOUR_GOBLOCK_API_KEY";

function Switch({ on, onChange, label }: { on: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={on ? "m-switch on" : "m-switch"}
      onClick={() => onChange(!on)}
    >
      <span />
    </button>
  );
}

function buildSnippets(url: string, key: string): Snippet[] {
  return [
    {
      label: "Cursor",
      file: "~/.cursor/mcp.json",
      code: `{
  "mcpServers": {
    "goblock": {
      "url": "${url}",
      "headers": { "x-api-key": "${key}" }
    }
  }
}`,
    },
    {
      label: "Claude Code",
      file: "Terminal",
      code: `claude mcp add --transport http goblock \\
  "${url}" \\
  --header "x-api-key: ${key}"`,
    },
    {
      label: "Claude Desktop",
      file: "claude_desktop_config.json",
      code: `{
  "mcpServers": {
    "goblock": {
      "command": "npx",
      "args": [
        "-y", "mcp-remote", "${url}",
        "--header", "x-api-key:${key}"
      ]
    }
  }
}`,
    },
    {
      label: "Windsurf",
      file: "~/.codeium/windsurf/mcp_config.json",
      code: `{
  "mcpServers": {
    "goblock": {
      "serverUrl": "${url}",
      "headers": { "x-api-key": "${key}" }
    }
  }
}`,
    },
    {
      label: "VS Code",
      file: ".vscode/mcp.json",
      code: `{
  "servers": {
    "goblock": {
      "type": "http",
      "url": "${url}",
      "headers": { "x-api-key": "${key}" }
    }
  }
}`,
    },
    {
      label: "Codex",
      file: "~/.codex/config.toml",
      code: `[mcp_servers.goblock]
command = "npx"
args = ["-y", "mcp-remote", "${url}", "--header", "x-api-key:${key}"]`,
    },
  ];
}

export function McpConsole() {
  const [key, setKey] = useState("");
  const [network, setNetwork] = useState<(typeof NETWORKS)[number]>("mainnet");
  const [slippage, setSlippage] = useState(100);
  const [tools, setTools] = useState(() => new Set(TOOLS.map((tool) => tool.id)));
  const [confirm, setConfirm] = useState(true);

  const snippets = useMemo(() => {
    const params = new URLSearchParams({ network, slippageBps: String(slippage) });
    if (tools.size < TOOLS.length) params.set("tools", TOOLS.filter((tool) => tools.has(tool.id)).map((tool) => tool.id).join(","));
    if (!confirm) params.set("confirm", "off");
    const url = `{origin}/mcp?${params.toString().replaceAll("%2C", ",")}`;
    return buildSnippets(url, key.trim() || KEY_HINT);
  }, [key, network, slippage, tools, confirm]);

  const toggleTool = (id: string, on: boolean) => {
    setTools((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else if (next.size > 1) next.delete(id);
      return next;
    });
  };

  return (
    <div className="m-console">
      <form className="m-settings" onSubmit={(event) => event.preventDefault()}>
        <div className="m-settings-head">
          <b>Settings</b>
          <span className="m-preview">Preview</span>
        </div>

        <label className="m-field">
          <small>API key</small>
          <input
            type="password"
            value={key}
            placeholder="Paste your key"
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => setKey(event.target.value)}
          />
          <em>Stays in this page. It is only placed into the config on the right.</em>
        </label>

        <div className="m-field">
          <small>Network</small>
          <div className="m-seg" role="radiogroup" aria-label="Network">
            {NETWORKS.map((item) => (
              <button
                key={item}
                type="button"
                role="radio"
                aria-checked={network === item}
                className={network === item ? "on" : undefined}
                onClick={() => setNetwork(item)}
              >
                {item === "mainnet" ? "Mainnet" : "Devnet"}
              </button>
            ))}
          </div>
        </div>

        <div className="m-field">
          <small>Default slippage</small>
          <div className="m-seg" role="radiogroup" aria-label="Default slippage">
            {SLIPPAGE.map((bps) => (
              <button
                key={bps}
                type="button"
                role="radio"
                aria-checked={slippage === bps}
                className={slippage === bps ? "on" : undefined}
                onClick={() => setSlippage(bps)}
              >
                {bps / 100}%
              </button>
            ))}
          </div>
        </div>

        <div className="m-field">
          <small>Tools</small>
          <ul className="m-tools">
            {TOOLS.map((tool) => (
              <li key={tool.id}>
                <span>
                  {tool.label}
                  <code>{tool.id}</code>
                </span>
                <Switch on={tools.has(tool.id)} onChange={(on) => toggleTool(tool.id, on)} label={tool.label} />
              </li>
            ))}
          </ul>
        </div>

        <div className="m-row">
          <span>
            Ask before building a transaction
            <em>The agent shows the quote and waits for a yes.</em>
          </span>
          <Switch on={confirm} onChange={setConfirm} label="Ask before building a transaction" />
        </div>
      </form>

      <div className="m-config">
        <CodeBlock snippets={snippets} />
        <p className="m-config-note">
          Paste the config, restart the agent, and look for <code>goblock</code> in its MCP list. The agent never signs:
          every swap is a transaction the wallet approves.
        </p>
      </div>
    </div>
  );
}
