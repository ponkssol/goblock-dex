"use client";

import { useEffect, useState } from "react";

export function SkillFile({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1400);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.append(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopied(true);
  };

  const download = () => {
    const blob = new Blob([text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "goblock-skill.md";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="c-block slim m-skill">
      <div className="c-bar m-skill-bar">
        <div className="c-tabs">
          <span>goblock://skill</span>
        </div>
        <div className="m-skill-actions">
          <button
            type="button"
            className={copied ? "c-copy done" : "c-copy"}
            onClick={() => {
              void copy();
            }}
          >
            {copied ? "Copied" : "Copy"}
          </button>
          <button type="button" className="c-copy" onClick={download}>
            Download
          </button>
        </div>
      </div>
      <pre className="c-body">
        <span className="c-file">goblock-skill.md</span>
        <code>{text}</code>
      </pre>
    </div>
  );
}
