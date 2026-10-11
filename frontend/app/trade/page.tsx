import { pageMeta } from "../site";
import { SwapCard } from "../swap-card";

export const metadata = pageMeta({
  title: "Trade · goblock",
  description:
    "Swap any Solana token at the best price across PumpSwap, the Pump bonding curve, Raydium, Meteora, and Orca. No goblock fee, signed in your own wallet.",
  path: "/trade",
  keywords: ["swap Solana tokens", "SOL to USDC", "pump.fun swap", "Solana DEX"],
});

export default function TradePage() {
  return <SwapCard />;
}
