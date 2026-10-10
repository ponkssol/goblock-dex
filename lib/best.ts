import BN from "bn.js";
import { quoteMeteora } from "./meteora";
import { quoteOrca } from "./orca";
import { quotePumpSwap } from "./pumpswap";
import type { SwapOrderInput, SwapQuote, SwapVenue } from "./quote";
import { quoteRaydium } from "./raydium";

const VENUE_BUDGET_MS = 12_000;

const builders: Record<SwapVenue, (input: SwapOrderInput) => Promise<SwapQuote>> = {
  PumpSwap: quotePumpSwap,
  "Bonding curve": quotePumpSwap,
  Raydium: quoteRaydium,
  Meteora: quoteMeteora,
  Orca: quoteOrca,
};

export async function quoteBest(input: SwapOrderInput): Promise<SwapQuote> {
  const settled = await Promise.allSettled([
    within(quotePumpSwap({ ...input, userPublicKey: undefined })),
    within(quoteRaydium({ ...input, userPublicKey: undefined })),
    within(quoteMeteora({ ...input, userPublicKey: undefined })),
    within(quoteOrca({ ...input, userPublicKey: undefined })),
  ]);
  const quotes = settled.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
  if (quotes.length === 0) throw new Error("No pool was found for this pair.");
  quotes.sort((left, right) => new BN(right.outAmount).cmp(new BN(left.outAmount)));
  if (!input.userPublicKey) return quotes[0];

  let lastError: unknown;
  for (const quote of quotes) {
    try {
      return await within(builders[quote.venue](input));
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Could not build the swap.");
}

function within(promise: Promise<SwapQuote>): Promise<SwapQuote> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("The venue quote timed out.")), VENUE_BUDGET_MS);
    promise.then(
      (quote) => {
        clearTimeout(timer);
        resolve(quote);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
