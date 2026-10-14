"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { shorten } from "@/lib/units";
import { solscan } from "./format";
import { DEPLOYER_WALLET } from "@/lib/admin";
import { Icon, type IconName } from "./icons";
import { dashboardApi, saveSession, useSession, type Earning, type NewKey, type Overview, type Session } from "./session";
import { SignInScreen, useSignIn } from "./sign-in";

type Dashboard = {
  session: Session;
  overview: Overview | null;
  error: string;
  refresh: () => Promise<void>;
  created: NewKey | null;
  setCreated: (key: NewKey | null) => void;
  earnings: Earning[] | null;
  earningsError: string;
  earningsBusy: boolean;
  loadEarnings: () => Promise<void>;
};

const Context = createContext<Dashboard | null>(null);

export function useDashboard() {
  const value = useContext(Context);
  if (!value) throw new Error("useDashboard must be used inside the dashboard.");
  return value;
}

/** Loads chain earnings the first time a page asks for them. */
export function useEarnings() {
  const dashboard = useDashboard();
  const { earnings, earningsBusy, loadEarnings } = dashboard;
  useEffect(() => {
    if (!earnings && !earningsBusy) void loadEarnings();
  }, [earnings, earningsBusy, loadEarnings]);
  return dashboard;
}

const ADMIN_NAV: { group: string; items: { href: string; label: string; icon: IconName }[] }[] = [
  {
    group: "Admin",
    items: [
      { href: "/admin", label: "Overview", icon: "overview" },
      { href: "/admin/keys", label: "All keys", icon: "keys" },
      { href: "/admin/payments", label: "Payments", icon: "earnings" },
      { href: "/admin/vouchers", label: "Discount codes", icon: "plan" },
    ],
  },
  {
    group: "Operator",
    items: [
      { href: "/admin/settings", label: "Pricing", icon: "earnings" },
      { href: "/admin/limits", label: "Rate limits", icon: "usage" },
      { href: "/admin/fees", label: "Fees", icon: "plan" },
      { href: "/admin/mint", label: "$GOBLOCK", icon: "shield" },
    ],
  },
];

const NAV: { group: string; items: { href: string; label: string; icon: IconName }[] }[] = [
  {
    group: "Workspace",
    items: [
      { href: "/dashboard", label: "Overview", icon: "overview" },
      { href: "/dashboard/keys", label: "API Keys", icon: "keys" },
      { href: "/dashboard/usage", label: "Usage", icon: "usage" },
    ],
  },
  {
    group: "Revenue",
    items: [
      { href: "/dashboard/earnings", label: "Earnings", icon: "earnings" },
      { href: "/dashboard/plan", label: "Plan & Fees", icon: "plan" },
    ],
  },
  {
    group: "Build",
    items: [
      { href: "/dashboard/quickstart", label: "Quickstart", icon: "quickstart" },
      { href: "/dashboard/playground", label: "Playground", icon: "play" },
      { href: "/docs", label: "API Docs", icon: "docs" },
    ],
  },
];

const TITLES: Record<string, string> = {
  "/dashboard": "Overview",
  "/dashboard/keys": "API Keys",
  "/dashboard/usage": "Usage",
  "/dashboard/earnings": "Earnings",
  "/dashboard/plan": "Plan & Fees",
  "/dashboard/quickstart": "Quickstart",
  "/dashboard/playground": "Playground",
  "/dashboard/settings": "Settings",
  "/admin": "Admin",
  "/admin/keys": "All keys",
  "/admin/payments": "Payments",
  "/admin/vouchers": "Discount codes",
  "/admin/settings": "Pricing",
  "/admin/limits": "Rate limits",
  "/admin/fees": "Fees",
  "/admin/mint": "$GOBLOCK",
};

function Provider({ session, children }: { session: Session; children: ReactNode }) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<NewKey | null>(null);
  const [earnings, setEarnings] = useState<Earning[] | null>(null);
  const [earningsError, setEarningsError] = useState("");
  const [earningsBusy, setEarningsBusy] = useState(false);
  const { token } = session;

  const refresh = useCallback(async () => {
    try {
      setOverview(await dashboardApi<Overview>("keys", token));
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The dashboard could not be loaded.");
    }
  }, [token]);

  const loadEarnings = useCallback(async () => {
    setEarningsBusy(true);
    try {
      setEarnings((await dashboardApi<{ wallets: Earning[] }>("earnings", token)).wallets);
      setEarningsError("");
    } catch (caught) {
      setEarnings([]);
      setEarningsError(caught instanceof Error ? caught.message : "Earnings could not be read.");
    } finally {
      setEarningsBusy(false);
    }
  }, [token]);

  useEffect(() => {
    setOverview(null);
    setCreated(null);
    setEarnings(null);
    void refresh();
    const timer = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(timer);
  }, [refresh]);

  return (
    <Context.Provider
      value={{
        session,
        overview,
        error,
        refresh,
        created,
        setCreated,
        earnings,
        earningsError,
        earningsBusy,
        loadEarnings,
      }}
    >
      {children}
    </Context.Provider>
  );
}

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const path = usePathname();
  const { overview, session } = useDashboard();
  const paid = overview?.plan === "paid";
  const deployer = session.wallet === DEPLOYER_WALLET;
  const groups = deployer ? [...NAV, ...ADMIN_NAV] : NAV;

  return (
    <aside className={open ? "ds-side open" : "ds-side"} aria-label="Dashboard">
      <div className="ds-side-top">
        <Link href="/" className="ds-logo" aria-label="goblock home">
          <img src="/goblock%20logo%20wordmark.png?v=2" alt="goblock" width={973} height={235} />
        </Link>
        <button className="ds-icon-btn ds-only-mobile" type="button" aria-label="Close menu" onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>

      <nav className="ds-nav">
        {groups.map((group) => (
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
                  onClick={onClose}
                >
                  <Icon name={item.icon} />
                  {item.label}
                  {item.href === "/dashboard/keys" && overview ? (
                    <em>{overview.keys.filter((key) => !key.revokedAt).length}</em>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="ds-side-foot">
        <div className="ds-plan-mini">
          <span className={paid ? "k-pill paid" : "k-pill"}>{paid ? "Monthly plan" : "Free plan"}</span>
          <p>{paid ? "No goblock fee on your swaps." : "0 to 20 bps on the SOL side of each swap."}</p>
          {paid ? null : (
            <Link href="/dashboard/plan" onClick={onClose}>
              Drop the fee
              <Icon name="arrow" size={14} />
            </Link>
          )}
        </div>
        <Link
          href="/dashboard/settings"
          className={path === "/dashboard/settings" ? "ds-side-link on" : "ds-side-link"}
          onClick={onClose}
        >
          <Icon name="settings" />
          Settings
        </Link>
      </div>
    </aside>
  );
}

function UserMenu() {
  const { session } = useDashboard();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <div className="ds-user" ref={box}>
      <button type="button" className="ds-user-btn" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <i aria-hidden="true">{session.wallet.slice(0, 2)}</i>
        <span>{shorten(session.wallet, 4, 4)}</span>
      </button>
      {open ? (
        <div className="ds-user-pop" role="menu">
          <div className="ds-user-head">
            <small>Signed in as</small>
            <code>{shorten(session.wallet, 8, 8)}</code>
          </div>
          <Link href="/dashboard/settings" role="menuitem" onClick={() => setOpen(false)}>
            <Icon name="settings" size={16} />
            Settings
          </Link>
          <a href={solscan(`account/${session.wallet}`)} target="_blank" rel="noreferrer" role="menuitem">
            <Icon name="arrow" size={16} />
            View on Solscan
          </a>
          <button type="button" role="menuitem" onClick={() => saveSession(null)}>
            <Icon name="out" size={16} />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Topbar({ onMenu }: { onMenu: () => void }) {
  const path = usePathname();
  const title = TITLES[path] ?? "Dashboard";

  return (
    <header className="ds-top">
      <button className="ds-icon-btn ds-only-mobile" type="button" aria-label="Open menu" onClick={onMenu}>
        <Icon name="menu" />
      </button>
      <div className="ds-crumb">
        <small>Dashboard</small>
        <span aria-hidden="true">/</span>
        <b>{title}</b>
      </div>
      <div className="ds-top-right">
        <Link className="ds-ghost ds-hide-small" href="/trade">
          Trade
        </Link>
        <Link className="p-btn ds-new" href="/dashboard/keys#create">
          <Icon name="plus" size={16} />
          <span>New Key</span>
        </Link>
        <UserMenu />
      </div>
    </header>
  );
}

function WalletBanner() {
  const { session } = useDashboard();
  const { address, connected, signIn, busy, error } = useSignIn();
  if (!connected || !address || address === session.wallet) return null;
  return (
    <div className="ds-banner">
      <p>
        Your wallet is now <b>{shorten(address, 4, 4)}</b>. This dashboard still shows <b>{shorten(session.wallet, 4, 4)}</b>.
        {error ? <span className="b-error"> {error}</span> : null}
      </p>
      <button className="p-btn line" type="button" disabled={busy} onClick={() => void signIn()}>
        {busy ? "Check your wallet…" : `Switch to ${shorten(address, 4, 4)}`}
      </button>
    </div>
  );
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const session = useSession();
  const path = usePathname();
  const [ready, setReady] = useState(false);
  const [menu, setMenu] = useState(false);

  useEffect(() => setReady(true), []);
  useEffect(() => setMenu(false), [path]);

  if (!ready) return <div className="ds-boot" aria-hidden="true" />;
  if (!session) return <SignInScreen />;

  return (
    <Provider key={session.wallet} session={session}>
      <div className={menu ? "ds menu-open" : "ds"}>
        <Sidebar open={menu} onClose={() => setMenu(false)} />
        <button className="ds-scrim" type="button" aria-label="Close menu" tabIndex={-1} onClick={() => setMenu(false)} />
        <div className="ds-main">
          <Topbar onMenu={() => setMenu(true)} />
          <WalletBanner />
          <main className="ds-content">{children}</main>
        </div>
      </div>
    </Provider>
  );
}

export function PageHead({ title, sub, children }: { title: string; sub: ReactNode; children?: ReactNode }) {
  return (
    <div className="ds-head">
      <div>
        <h1>{title}</h1>
        <p>{sub}</p>
      </div>
      {children ? <div className="ds-head-actions">{children}</div> : null}
    </div>
  );
}

export function Tab({ children }: { children: ReactNode }) {
  return (
    <span className="ds-tab">
      <i aria-hidden="true" />
      {children}
    </span>
  );
}

/**
 * A folder card (tab on top) by default, or a regular card with `plain`.
 * Folder cards fill the space beside the tab with `action`, or with `sub` when there is no action.
 */
export function Card({
  title,
  sub,
  action,
  plain,
  className = "",
  children,
}: {
  title: string;
  sub?: ReactNode;
  action?: ReactNode;
  plain?: boolean;
  className?: string;
  children: ReactNode;
}) {
  if (plain) {
    return (
      <section className={`ds-panel ${className}`.trim()}>
        <header className="ds-panel-head">
          <div>
            <h2>{title}</h2>
            {sub ? <p>{sub}</p> : null}
          </div>
          {action}
        </header>
        {children}
      </section>
    );
  }

  const side = action ?? (sub ? <span className="ds-card-meta">{sub}</span> : null);
  return (
    <section className={`ds-card ${className}`.trim()}>
      <header className="ds-card-tabs">
        <h2 className="ds-tab">
          <i aria-hidden="true" />
          {title}
        </h2>
        {side ? <div className="ds-card-action">{side}</div> : null}
      </header>
      <div className="ds-card-body">
        {action && sub ? <p className="ds-card-sub">{sub}</p> : null}
        {children}
      </div>
    </section>
  );
}

export function Kpi({
  label,
  value,
  foot,
  icon,
  tone,
  lime,
  children,
}: {
  label: string;
  value: ReactNode;
  foot: ReactNode;
  icon: IconName;
  tone?: "up" | "down";
  lime?: boolean;
  children?: ReactNode;
}) {
  return (
    <li className={lime ? "ds-kpi lime" : "ds-kpi"}>
      <div className="ds-kpi-top">
        <small>{label}</small>
        <span className="ds-kpi-icon">
          <Icon name={icon} size={18} />
        </span>
      </div>
      <strong>{value}</strong>
      <span className={tone ? `ds-foot ${tone}` : "ds-foot"}>{foot}</span>
      {children}
    </li>
  );
}

/** Shown while the first overview request is in flight. */
export function useLoaded() {
  const dashboard = useDashboard();
  const placeholder = dashboard.overview ? null : dashboard.error ? (
    <p className="b-error">{dashboard.error}</p>
  ) : (
    <div className="ds-loading">
      <i />
      <i />
      <i />
    </div>
  );
  return { ...dashboard, placeholder };
}
