import { AddressLookupTableAccount, PublicKey, type TransactionInstruction } from "@solana/web3.js";
import BN from "bn.js";
import { quoteMeteora } from "./meteora";
import { quoteOrca } from "./orca";
import { quotePumpSwap } from "./pumpswap";
import type { SwapOrderInput, SwapQuote, SwapReceipt, SwapVenue } from "./quote";
import { quoteRaydium } from "./raydium";
import { SOL_MINT, USDC } from "./tokens";
import { brandFee } from "./fees";
import { buildSwapTransaction, outputAfterFee } from "./trade";

const VENUE_BUDGET_MS = 4_000;
const FIRST_PRICE_GRACE_MS = 600;
const PRICE_CACHE_MS = 12_000;

type Executable = SwapQuote & {
  instructions?: TransactionInstruction[];
  lookupTables?: AddressLookupTableAccount[];
};

type Step = { venue: SwapVenue; input: SwapOrderInput };

type Plan = { quote: Executable; steps?: Step[] };

const builders: Record<SwapVenue, (input: SwapOrderInput) => Promise<SwapQuote>> = {
  PumpSwap: quotePumpSwap,
  "Bonding curve": quotePumpSwap,
  Raydium: quoteRaydium,
  Meteora: quoteMeteora,
  Orca: quoteOrca,
};

const probes: SwapVenue[] = ["PumpSwap", "Raydium", "Meteora", "Orca"];

type CachedPrice = { at: number; quote: SwapQuote; complete: boolean };
const priceCache = new Map<string, CachedPrice>();
const shown = new Map<string, Promise<SwapQuote>>();

export async function quoteBest(input: SwapOrderInput): Promise<SwapQuote> {
  if (input.userPublicKey) return quoteReady(input);
  return quoteShown(input);
}

async function quoteReady(input: SwapOrderInput): Promise<SwapQuote> {
  const priced = previewOf(input);
  const direct = await probeAll(priced);
  const [hops, split] = await Promise.all([
    Promise.all(intermediates(input).map((mid) => quoteHop(input, mid))),
    quoteSplit(input, direct),
  ]);
  const winner = pickWinner(direct, [...hops, split]);
  if (!winner) throw new Error("No pool was found for this pair.");
  const trace = traceOf(direct);
  try {
    const quote = await materialize(input, winner);
    return { ...quote, trace };
  } catch (error) {
    const alternate = winner.steps ? direct : direct.filter((quote) => quote.venue !== winner.quote.venue);
    if (alternate.length === 0) throw error;
    const quote = await materialize(input, { quote: bestOf(alternate) });
    return { ...quote, trace };
  }
}

function quoteShown(input: SwapOrderInput): Promise<SwapQuote> {
  const key = priceKey(input);
  const cached = readPrice(key);
  if (cached) return Promise.resolve(cached);
  const pending = shown.get(key);
  if (pending) return pending;

  const run = (async () => {
    const { soon, rest } = collectProbes(previewOf(input));
    const early = await soon;
    if (early.length === 0) {
      const finished = await rest;
      if (finished.length === 0) throw new Error("No pool was found for this pair.");
      const quote = { ...publish(bestOf(finished)), trace: traceOf(finished) };
      remember(key, quote, true);
      return quote;
    }
    const quote = { ...publish(bestOf(early)), trace: traceOf(early) };
    remember(key, quote, false);
    void improve(input, key, rest, quote);
    return quote;
  })();

  shown.set(key, run);
  void run.finally(() => shown.delete(key));
  return run;
}

async function improve(
  input: SwapOrderInput,
  key: string,
  rest: Promise<Executable[]>,
  earlyQuote: SwapQuote,
): Promise<void> {
  try {
    const direct = await rest;
    if (direct.length === 0) {
      remember(key, earlyQuote, true);
      return;
    }
    const [hops, split] = await Promise.all([
      Promise.all(intermediates(input).map((mid) => quoteHop(input, mid))),
      quoteSplit(input, direct),
    ]);
    const winner = pickWinner(direct, [...hops, split]);
    let quote = winner ? { ...publish(winner.quote), trace: traceOf(direct) } : earlyQuote;
    if (winner && !winner.steps && input.inputMint === SOL_MINT) {
      try {
        const refreshed = (await within(
          builders[winner.quote.venue]({ ...previewOf(input), roundTrip: true }),
        )) as Executable;
        quote = { ...publish(refreshed), trace: traceOf(direct), route: winner.quote.route };
      } catch {
        // Keep the price that is already on screen.
      }
    }
    remember(key, quote, true);
  } catch {
    remember(key, earlyQuote, true);
  }
}

function pickWinner(direct: Executable[], extras: Array<Plan | null>): Plan | null {
  let winner: Plan | null = direct.length > 0 ? { quote: bestOf(direct) } : null;
  for (const extra of extras) {
    if (!extra) continue;
    if (!winner || new BN(extra.quote.outAmount).cmp(new BN(winner.quote.outAmount)) > 0) winner = extra;
  }
  return winner;
}

function previewOf(input: SwapOrderInput): SwapOrderInput {
  return { ...input, userPublicKey: undefined, assemble: undefined, roundTrip: false };
}

function priceKey(input: SwapOrderInput): string {
  return [input.inputMint, input.outputMint, input.amount, input.slippageBps, input.brandWallet ?? "", input.brand ?? ""].join("|");
}

function readPrice(key: string): SwapQuote | null {
  const cached = priceCache.get(key);
  if (!cached) return null;
  const age = Date.now() - cached.at;
  if (!cached.complete && age < 12_000) return cached.quote;
  if (cached.complete && age < PRICE_CACHE_MS) return cached.quote;
  return null;
}

function remember(key: string, quote: SwapQuote, complete: boolean) {
  priceCache.set(key, { at: Date.now(), quote, complete });
  if (priceCache.size <= 40) return;
  const oldest = [...priceCache.entries()].sort((left, right) => left[1].at - right[1].at)[0];
  if (oldest) priceCache.delete(oldest[0]);
}

function traceOf(direct: Executable[]): SwapQuote["trace"] {
  return direct
    .map((quote) => ({ venue: quote.venue, ms: 0, ok: true, outAmount: quote.outAmount }))
    .sort((left, right) => new BN(right.outAmount ?? "0").cmp(new BN(left.outAmount ?? "0")));
}

function intermediates(input: SwapOrderInput): string[] {
  return [SOL_MINT, USDC.mint].filter((mint) => mint !== input.inputMint && mint !== input.outputMint);
}

async function quoteHop(input: SwapOrderInput, mid: string): Promise<Plan | null> {
  const amount = tradable(input);
  if (amount.lten(0)) return null;
  const opening = await probeAll({
    inputMint: input.inputMint,
    outputMint: mid,
    amount: amount.toString(),
    slippageBps: input.slippageBps,
  });
  if (opening.length === 0) return null;
  const first = bestOf(opening);
  const closing = await probeAll({
    inputMint: mid,
    outputMint: input.outputMint,
    amount: first.outAmount,
    slippageBps: input.slippageBps,
  });
  if (closing.length === 0) return null;
  const second = bestOf(closing);
  const openingInput = {
    inputMint: input.inputMint,
    outputMint: mid,
    amount: amount.toString(),
    slippageBps: input.slippageBps,
  };
  return planFromLegs(input, [first, second], `${first.venue} → ${second.venue}`, [
    { venue: first.venue, input: openingInput },
    {
      venue: second.venue,
      input: {
        inputMint: mid,
        outputMint: input.outputMint,
        amount: first.outAmount,
        slippageBps: input.slippageBps,
      },
    },
  ], "last");
}

async function quoteSplit(input: SwapOrderInput, direct: Executable[]): Promise<Plan | null> {
  if (direct.length < 2) return null;
  const ranked = [...direct].sort((left, right) => new BN(right.outAmount).cmp(new BN(left.outAmount)));
  const [primary, secondary] = ranked;
  const total = tradable(input);
  let winner: Plan | null = null;
  const cuts = await Promise.all(
    [5_000, 7_000].map(async (bps) => {
      const [leftAmount, rightAmount] = cut(total, bps);
      if (leftAmount.lten(0) || rightAmount.lten(0)) return null;
      const [left, right] = await Promise.all([
        probeVenue(primary.venue, pair(input, leftAmount)),
        probeVenue(secondary.venue, pair(input, rightAmount)),
      ]);
      if (!left || !right) return null;
      const share = bps / 100;
      return planFromLegs(input, [left, right], `${primary.venue} ${share}% + ${secondary.venue} ${100 - share}%`, [
        { venue: left.venue, input: pair(input, leftAmount) },
        { venue: right.venue, input: pair(input, rightAmount) },
      ]);
    }),
  );
  for (const plan of cuts) {
    if (!plan) continue;
    if (!winner || new BN(plan.quote.outAmount).cmp(new BN(winner.quote.outAmount)) > 0) winner = plan;
  }
  return winner;
}

function planFromLegs(
  input: SwapOrderInput,
  legs: Executable[],
  route: string,
  steps: Step[],
  combine: "sum" | "last" = "sum",
): Plan | null {
  const last = legs[legs.length - 1];
  const gross = combine === "last" ? new BN(last.outAmount) : legs.reduce((sum, leg) => sum.add(new BN(leg.outAmount)), new BN(0));
  const minGross = combine === "last" ? new BN(last.minOutAmount) : legs.reduce((sum, leg) => sum.add(new BN(leg.minOutAmount)), new BN(0));
  const settled = settle(gross, minGross, input);
  if (settled.out.lten(0) || settled.min.lten(0)) return null;
  return {
    quote: {
      ...last,
      side: input.inputMint === SOL_MINT ? "buy" : "sell",
      inAmount: input.amount,
      outAmount: settled.out.toString(),
      minOutAmount: settled.min.toString(),
      maxInAmount: input.amount,
      feeBps: settled.fee.isZero() ? 0 : 5,
      feeAmount: settled.fee.toString(),
      route,
      pool: legs.map((leg) => leg.pool).join(","),
      receipt: pickReceipt(legs),
      roundTripOutAmount: undefined,
      instructions: undefined,
      lookupTables: undefined,
    },
    steps,
  };
}

async function materialize(input: SwapOrderInput, plan: Plan): Promise<SwapQuote> {
  const quote = publish(plan.quote);
  if (!input.userPublicKey) return quote;
  if (!plan.steps) return builders[quote.venue]({ ...input, roundTrip: false });

  const user = input.userPublicKey;
  const builtLegs: Executable[] = [];
  for (const step of plan.steps) {
    const built = (await within(
      builders[step.venue]({ ...step.input, userPublicKey: user, assemble: false }),
    )) as Executable;
    if (!built.instructions?.length) throw new Error("Could not build the swap.");
    builtLegs.push(built);
  }
  const instructions = builtLegs.flatMap((leg) => leg.instructions ?? []);
  const lookupTables = dedupeTables(builtLegs.flatMap((leg) => leg.lookupTables ?? []));
  const transaction = await buildSwapTransaction({
    user: new PublicKey(user),
    instructions,
    lookupTables,
    brand: input.brand,
    brandWallet: input.brandWallet,
    fee: new BN(quote.feeAmount),
    outputMint: input.outputMint,
    minOut: new BN(quote.minOutAmount),
  });
  return { ...quote, ...transaction };
}

function pair(input: SwapOrderInput, amount: BN): SwapOrderInput {
  return {
    inputMint: input.inputMint,
    outputMint: input.outputMint,
    amount: amount.toString(),
    slippageBps: input.slippageBps,
  };
}

function tradable(input: SwapOrderInput): BN {
  const amount = new BN(input.amount);
  if (input.inputMint !== SOL_MINT || !input.brandWallet) return amount;
  const fee = brandFee(amount, true);
  return fee.gte(amount) ? new BN(0) : amount.sub(fee);
}

function inputFee(input: SwapOrderInput): BN {
  if (input.inputMint !== SOL_MINT) return new BN(0);
  return brandFee(new BN(input.amount), Boolean(input.brandWallet));
}

function settle(gross: BN, minGross: BN, input: SwapOrderInput): { out: BN; min: BN; fee: BN } {
  const outputIsSol = input.outputMint === SOL_MINT && input.inputMint !== SOL_MINT;
  if (!outputIsSol) return { out: gross, min: minGross, fee: inputFee(input) };
  const { outAmount, outputFee } = outputAfterFee(gross, true, Boolean(input.brandWallet));
  const minFee = brandFee(minGross, Boolean(input.brandWallet));
  const min = minGross.gt(minFee) ? minGross.sub(minFee) : new BN(0);
  return { out: outAmount, min, fee: outputFee };
}

function cut(total: BN, bps: number): [BN, BN] {
  const left = total.muln(bps).divn(10_000);
  return [left, total.sub(left)];
}

function pickReceipt(legs: Executable[]): SwapReceipt {
  return (
    legs.find((leg) => leg.venue === "PumpSwap" || leg.venue === "Bonding curve")?.receipt ??
    legs[legs.length - 1].receipt
  );
}

function bestOf(quotes: Executable[]): Executable {
  return [...quotes].sort((left, right) => new BN(right.outAmount).cmp(new BN(left.outAmount)))[0];
}

function publish(quote: Executable): SwapQuote {
  const published = { ...quote };
  delete published.instructions;
  delete published.lookupTables;
  return published;
}

function dedupeTables(tables: AddressLookupTableAccount[]): AddressLookupTableAccount[] {
  const seen = new Set<string>();
  return tables.filter((table) => {
    const key = table.key.toBase58();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function probeAll(input: SwapOrderInput): Promise<Executable[]> {
  return (await collectProbes(input)).rest;
}

function collectProbes(input: SwapOrderInput): { soon: Promise<Executable[]>; rest: Promise<Executable[]> } {
  const found: Executable[] = [];
  let remaining = probes.length;
  let soonSettled = false;
  let armed = false;
  let resolveSoon: (quotes: Executable[]) => void = () => {};
  let resolveRest: (quotes: Executable[]) => void = () => {};
  const soon = new Promise<Executable[]>((resolve) => {
    resolveSoon = resolve;
  });
  const rest = new Promise<Executable[]>((resolve) => {
    resolveRest = resolve;
  });

  const settleSoon = () => {
    if (soonSettled) return;
    soonSettled = true;
    resolveSoon([...found]);
  };

  for (const venue of probes) {
    void probeVenue(venue, input).then((quote) => {
      if (quote) {
        found.push(quote);
        if (!armed) {
          armed = true;
          setTimeout(settleSoon, FIRST_PRICE_GRACE_MS);
        }
      }
      remaining -= 1;
      if (remaining === 0) {
        settleSoon();
        resolveRest([...found]);
      }
    });
  }

  return { soon, rest };
}

async function probeVenue(venue: SwapVenue, input: SwapOrderInput): Promise<Executable | null> {
  try {
    return (await within(builders[venue](input))) as Executable;
  } catch {
    return null;
  }
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
