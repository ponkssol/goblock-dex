"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { DEPLOYER_WALLET } from "@/lib/admin";
import { shorten } from "@/lib/units";
import { Icon, type IconName } from "../../dashboard/_ui/icons";
import { saveSession, useSession } from "../../dashboard/_ui/session";
import { SignInScreen } from "../../dashboard/_ui/sign-in";

const NAV: { group: string; items: { href: string; label: string; icon: IconName }[] }[] = [
  {
    group: "Control",
    items: [
      { href: "/admin", label: "Overview", icon: "overview" },
      { href: "/admin/waitlist", label: "Waitlist", icon: "users" },
      { href: "/admin/keys", label: "API Keys", icon: "keys" },
      { href: "/admin/payments", label: "Payments", icon: "earnings" },
      { href: "/admin/vouchers", label: "Discount codes", icon: "plan" },
    ],
  },
  {
    group: "Settings",
    items: [
      { href: "/admin/settings", label: "Pricing", icon: "earnings" },
      { href: "/admin/limits", label: "Rate limits", icon: "usage" },
      { href: "/admin/fees", label: "Fees", icon: "plan" },
      { href: "/admin/mint", label: "$GOBLOCK", icon: "shield" },
    ],
  },
  {
    group: "Open",
    items: [
      { href: "/dashboard", label: "API Console", icon: "quickstart" },
      { href: "/buyback", label: "Buyback", icon: "shield" },
      { href: "/waitlist", label: "Public waitlist", icon: "arrow" },
    ],
  },
];

const TITLES: Record<string, string> = {
  "/admin": "Overview",
  "/admin/waitlist": "Waitlist",
  "/admin/keys": "API Keys",
  "/admin/payments": "Payments",
  "/admin/vouchers": "Discount codes",
  "/admin/settings": "Pricing",
  "/admin/limits": "Rate limits",
  "/admin/fees": "Fees",
  "/admin/mint": "$GOBLOCK",
};

const INSIDE: [IconName, string, string][] = [
  ["users", "Waitlist", "Everyone who asked to be notified, with the wallet they left."],
  ["keys", "API keys", "Every key on goblock. Revoke one without opening that wallet."],
  ["earnings", "Payments", "Builder and Starter checkouts, with the plan and the asset."],
  ["plan", "Discount codes", "Create a checkout code, or turn one off."],
];

export function AdminShell({ children }: { children: ReactNode }) {
  const session = useSession();
  const path = usePathname();
  const [ready, setReady] = useState(false);
  const [menu, setMenu] = useState(false);

  useEffect(() => setReady(true), []);
  useEffect(() => setMenu(false), [path]);

  if (!ready) return <div className="ds-boot" aria-hidden="true" />;
  if (!session) {
    return (
      <SignInScreen
        title="Sign in to Admin"
        lead="Use the wallet that deployed the goblock program. Other wallets cannot open this page."
        chip="Admin"
        asideTitle="Keys, payments, codes, and the waitlist."
        asideBody="One console for the program deployer. Everyone else stops at the door."
        inside={INSIDE}
        alt={{ href: "/dashboard", label: "Open the API Console" }}
      />
    );
  }
  if (session.wallet !== DEPLOYER_WALLET) {
    return (
      <div className="ds-gate">
        <div className="au">
          <section className="au-main">
            <header className="au-top">
              <Link href="/" className="ds-logo" aria-label="goblock home">
                <img src="/goblock%20logo%20wordmark.png?v=2" alt="goblock" width={973} height={235} />
              </Link>
              <Link href="/" className="ds-ghost">
                <Icon name="back" size={16} />
                Back to goblock
              </Link>
            </header>
            <div className="au-box">
              <span className="au-badge">
                <Icon name="shield" size={16} />
              </span>
              <h1>This console is locked.</h1>
              <p className="au-lead">
                Signed in as {shorten(session.wallet, 4, 4)}. Only the wallet that deployed the goblock program can open Admin.
              </p>
              <div className="au-actions">
                <button className="p-btn au-go" type="button" onClick={() => saveSession(null)}>
                  Sign out
                </button>
                <Link className="ds-ghost" href="/dashboard">
                  Open the API Console
                </Link>
              </div>
            </div>
          </section>
          <aside className="au-side" aria-label="What is inside">
            <img className="au-mark" src="/goblock-mark.png" alt="" aria-hidden="true" />
            <div className="au-side-copy">
              <span className="ds-chip">
                <i />
                Admin
              </span>
              <h2>Keys, payments, codes, and the waitlist.</h2>
              <p>One console for the program deployer. Everyone else stops at the door.</p>
            </div>
          </aside>
        </div>
      </div>
    );
  }

  const title = TITLES[path] ?? "Admin";

  return (
    <div className={menu ? "ds menu-open" : "ds"}>
      <aside className={menu ? "ds-side open" : "ds-side"} aria-label="Admin">
        <div className="ds-side-top">
          <Link href="/" className="ds-logo" aria-label="goblock home">
            <img src="/goblock%20logo%20wordmark.png?v=2" alt="goblock" width={973} height={235} />
          </Link>
          <button className="ds-icon-btn ds-only-mobile" type="button" aria-label="Close menu" onClick={() => setMenu(false)}>
            <Icon name="close" />
          </button>
        </div>
        <span className="ds-side-tag">Admin</span>
        <nav className="ds-nav">
          {NAV.map((group) => (
            <div key={group.group} className="ds-nav-group">
              <small>{group.group}</small>
              {group.items.map((item) => {
                const here = path === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={here ? "on" : undefined}
                    aria-current={here ? "page" : undefined}
                    onClick={() => setMenu(false)}
                  >
                    <Icon name={item.icon} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="ds-side-foot">
          <div className="ds-plan-mini">
            <span className="k-pill paid">Deployer</span>
            <p>Signed in as {shorten(session.wallet, 4, 4)}.</p>
          </div>
        </div>
      </aside>
      <button className="ds-scrim" type="button" aria-label="Close menu" tabIndex={-1} onClick={() => setMenu(false)} />
      <div className="ds-main">
        <header className="ds-top">
          <button className="ds-icon-btn ds-only-mobile" type="button" aria-label="Open menu" onClick={() => setMenu(true)}>
            <Icon name="menu" />
          </button>
          <div className="ds-crumb">
            <small>Admin</small>
            <span aria-hidden="true">/</span>
            <b>{title}</b>
          </div>
          <div className="ds-top-right">
            <Link className="ds-ghost ds-hide-small" href="/dashboard">
              API Console
            </Link>
            <button className="p-btn line" type="button" onClick={() => saveSession(null)}>
              Sign out
            </button>
          </div>
        </header>
        <main className="ds-content">{children}</main>
      </div>
    </div>
  );
}
