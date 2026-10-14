"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { shorten } from "@/lib/units";
import { useWalletLite } from "./wallet-lite";

const AGENTS = [
  { src: "/agents/claude.svg", name: "Claude" },
  { src: "/agents/cursor.svg", name: "Cursor" },
  { src: "/agents/codex.svg", name: "Codex" },
  { src: "/agents/windsurf.svg", name: "Windsurf" },
  { src: "/agents/vscode.svg", name: "VS Code" },
];

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/trade", label: "Trade" },
  { href: "/pricing", label: "Pricing" },
  { href: "/dashboard", label: "API Console" },
];

export function SiteNav() {
  const path = usePathname();
  const { address, connected, disconnect, openWallet, preload } = useWalletLite();
  const [menu, setMenu] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const slot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNavOpen(false);
  }, [path]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!menu) return;
    const close = (event: PointerEvent) => {
      if (!slot.current?.contains(event.target as Node)) setMenu(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [menu]);

  return (
    <header className={["nav", navOpen ? "open" : "", scrolled ? "scrolled" : ""].filter(Boolean).join(" ")}>
      <div className="brand">
        <Link href="/" className="lockup" aria-label="goblock home">
          <img src="/goblock%20logo%20wordmark.png?v=2" alt="goblock" width={973} height={235} fetchPriority="high" />
        </Link>
      </div>
      <button
        className="nav-toggle"
        type="button"
        aria-label={navOpen ? "Close menu" : "Open menu"}
        aria-expanded={navOpen}
        onClick={() => setNavOpen((open) => !open)}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          {navOpen ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      <nav className="links" aria-label="Primary">
        {LINKS.map((link) => {
          const current = link.href === "/" ? path === "/" : path === link.href || path.startsWith(`${link.href}/`);
          return (
            <Link key={link.href} href={link.href} className={current ? "here" : undefined} aria-current={current ? "page" : undefined}>
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="wallet-slot" ref={slot}>
        <Link className="claude" href="/mcp" aria-label="Connect" title="Connect">
          <span className="claude-logos" aria-hidden="true">
            {AGENTS.map((agent) => (
              <img key={agent.name} src={agent.src} alt="" width={18} height={18} />
            ))}
          </span>
          <span className="claude-label">Connect</span>
        </Link>
        <button
          className="wallet"
          type="button"
          aria-expanded={menu}
          onPointerEnter={preload}
          onFocus={preload}
          onClick={() => (connected ? setMenu((open) => !open) : openWallet())}
        >
          {connected && address ? shorten(address) : "Connect Wallet"}
        </button>
        {menu && connected ? (
          <div className="wallet-pop" role="menu">
            <button
              type="button"
              onClick={() => {
                setMenu(false);
                openWallet();
              }}
            >
              Change wallet
            </button>
            <button
              type="button"
              onClick={() => {
                setMenu(false);
                void disconnect();
              }}
            >
              Disconnect
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
