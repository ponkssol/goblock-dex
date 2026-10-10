"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { shorten } from "@/lib/units";

const LINKS = [
  { href: "/", label: "Trade" },
  { href: "/docs", label: "Docs" },
  { href: "/pricing", label: "Pricing" },
  { href: "/keys", label: "Keys" },
  { href: "/brand", label: "Brand" },
];

export function SiteNav() {
  const path = usePathname();
  const { publicKey, connected, disconnect } = useWallet();
  const { setVisible } = useWalletModal();

  return (
    <header className="nav">
      <div className="brand">
        <Link href="/" className="lockup" aria-label="goblock home">
          <img src="/goblock-logo.png" alt="goblock" />
        </Link>
      </div>
      <nav className="links" aria-label="Primary">
        {LINKS.map((link) => {
          const on = link.href === "/" ? path === "/" : path === link.href;
          return (
            <Link key={link.href} href={link.href} className={on ? "here" : undefined} aria-current={on ? "page" : undefined}>
              {link.label}
            </Link>
          );
        })}
      </nav>
      <button className="wallet" type="button" onClick={() => (connected ? disconnect() : setVisible(true))}>
        {connected && publicKey ? shorten(publicKey.toBase58()) : "Connect Wallet"}
      </button>
    </header>
  );
}
