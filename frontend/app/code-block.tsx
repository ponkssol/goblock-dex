"use client";

import { useEffect, useState, type ReactNode } from "react";

export type Snippet = { label: string; code: string; file?: string; icon?: string };

const TOKEN = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\/\/.*$|#.*$|\b\d+\b|\$\{?[A-Z_]+\}?)/gm;

function paint(code: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of code.matchAll(TOKEN)) {
    const text = match[0];
    const at = match.index ?? 0;
    if (at > last) parts.push(code.slice(last, at));
    const kind = /^["'`]/.test(text) ? "str" : /^(\/\/|#)/.test(text) ? "dim" : /^\$/.test(text) ? "env" : "num";
    parts.push(
      <span key={at} className={`c-${kind}`}>
        {text}
      </span>,
    );
    last = at + text.length;
  }
  if (last < code.length) parts.push(code.slice(last));
  return parts;
}

export function CodeBlock({ snippets, className = "" }: { snippets: Snippet[]; className?: string }) {
  const [active, setActive] = useState(0);
  const [origin, setOrigin] = useState("https://your-goblock-host");
  const [copied, setCopied] = useState(false);
  const current = snippets[Math.min(active, snippets.length - 1)];
  const code = current.code.replaceAll("{origin}", origin);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1400);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <div className={`c-block ${className}`.trim()}>
      <div className="c-bar">
        <div className="c-tabs" role="tablist" aria-label="Code language">
          {snippets.map((snippet, index) => (
            <button
              key={snippet.label}
              type="button"
              role="tab"
              aria-selected={index === active}
              className={index === active ? "on" : undefined}
              onClick={() => setActive(index)}
            >
              {snippet.icon ? <img src={snippet.icon} alt="" width={16} height={16} /> : null}
              {snippet.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={copied ? "c-copy done" : "c-copy"}
          onClick={() => {
            void navigator.clipboard?.writeText(code).then(() => setCopied(true));
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="c-body" key={active}>
        {current.file ? <span className="c-file">{current.file}</span> : null}
        <code>{paint(code)}</code>
      </pre>
    </div>
  );
}
