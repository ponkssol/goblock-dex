import Link from "next/link";
import { m } from "./motion";
import { Reveal } from "./reveal";

export function SiteFoot() {
  return (
    <Reveal className="s-foot" motion="foot">
      <div className="j-wrap">
        <div className="s-foot-top" {...m("rise")}>
          <div>
            <Link href="/" className="lockup" aria-label="goblock home">
              <img src="/goblock%20logo%20wordmark.png?v=2" alt="goblock" width={973} height={235} loading="lazy" decoding="async" />
            </Link>
            <p>Raydium, Orca, Meteora, and PumpSwap in one quote, signed in your wallet.</p>
          </div>
          <nav aria-label="Footer">
            <Link href="/">Home</Link>
            <Link href="/trade">Trade</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/docs">Docs</Link>
            <Link href="/mcp">MCP</Link>
          </nav>
        </div>
        <div className="s-foot-bottom" {...m("rise", 100)}>
          <small>© {new Date().getFullYear()} goblock</small>
          <small>Built on Solana</small>
        </div>
      </div>
    </Reveal>
  );
}
