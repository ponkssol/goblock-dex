"use client";

import { CodeBlock, type Snippet } from "../code-block";

const KEY = "YOUR_GOBLOCK_API_KEY";
const URL = "{origin}/api/mcp?slippageBps=100";

function json(body: string) {
  return body.trim();
}

const SNIPPETS: Snippet[] = [
  {
    label: "Cursor",
    icon: "/agents/cursor.svg",
    file: "~/.cursor/mcp.json",
    code: json(`{
  "mcpServers": {
    "goblock": {
      "url": "${URL}",
      "headers": { "x-api-key": "${KEY}" }
    }
  }
}`),
  },
  {
    label: "Claude",
    icon: "/agents/claude.svg",
    file: "Terminal",
    code: `claude mcp add --transport http goblock \\
  "${URL}" \\
  --header "x-api-key: ${KEY}"`,
  },
  {
    label: "Windsurf",
    icon: "/agents/windsurf.svg",
    file: "~/.codeium/windsurf/mcp_config.json",
    code: json(`{
  "mcpServers": {
    "goblock": {
      "serverUrl": "${URL}",
      "headers": { "x-api-key": "${KEY}" }
    }
  }
}`),
  },
  {
    label: "VS Code",
    icon: "/agents/vscode.svg",
    file: ".vscode/mcp.json",
    code: json(`{
  "servers": {
    "goblock": {
      "type": "http",
      "url": "${URL}",
      "headers": { "x-api-key": "${KEY}" }
    }
  }
}`),
  },
  {
    label: "Codex",
    icon: "/agents/codex.svg",
    file: "~/.codex/config.toml",
    code: `[mcp_servers.goblock]
command = "npx"
args = ["-y", "mcp-remote", "${URL}", "--header", "x-api-key:${KEY}"]`,
  },
  {
    label: "OpenCode",
    icon: "/agents/opencode.svg",
    file: "opencode.json",
    code: json(`{
  "mcp": {
    "goblock": {
      "type": "remote",
      "url": "${URL}",
      "headers": { "x-api-key": "${KEY}" }
    }
  }
}`),
  },
  {
    label: "OpenClaw",
    icon: "/agents/openclaw.svg",
    file: "~/.openclaw/openclaw.json",
    code: json(`{
  "mcp": {
    "servers": {
      "goblock": {
        "url": "${URL}",
        "headers": { "x-api-key": "${KEY}" }
      }
    }
  }
}`),
  },
  {
    label: "Hermes",
    icon: "/agents/hermes.png",
    file: "~/.hermes/config.yaml",
    code: `mcp_servers:
  goblock:
    url: ${URL}
    headers:
      x-api-key: ${KEY}`,
  },
  {
    label: "Cline",
    icon: "/agents/cline.svg",
    file: "cline_mcp_settings.json",
    code: json(`{
  "mcpServers": {
    "goblock": {
      "url": "${URL}",
      "headers": { "x-api-key": "${KEY}" }
    }
  }
}`),
  },
  {
    label: "Zed",
    icon: "/agents/zed.svg",
    file: "~/.config/zed/settings.json",
    code: json(`{
  "context_servers": {
    "goblock": {
      "url": "${URL}",
      "headers": { "x-api-key": "${KEY}" }
    }
  }
}`),
  },
];

export function McpConsole() {
  return (
    <div className="m-config">
      <CodeBlock snippets={SNIPPETS} />
    </div>
  );
}
