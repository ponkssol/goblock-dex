const fresh = new Map<string, { until: number; value: unknown }>();

const RANGES: Record<string, { interval: string; candles: number }> = {
  "1H": { interval: "1_MINUTE", candles: 60 },
  "4H": { interval: "5_MINUTE", candles: 48 },
  "1D": { interval: "15_MINUTE", candles: 96 },
  "1W": { interval: "1_HOUR", candles: 168 },
};

export type ChartSide = {
  candles: { time: number; open: number; high: number; low: number; close: number }[];
  price: number | null;
  change: number | null;
  volume: number | null;
  mcap: number | null;
  liquidity: number | null;
  holders: number | null;
  msg?: string;
};

type JupiterToken = {
  id?: string;
  usdPrice?: number;
  mcap?: number;
  liquidity?: number;
  holderCount?: number;
  stats24h?: { buyVolume?: number; sellVolume?: number };
};

export type BookPrint = {
  id: string;
  seq: string;
  price: number;
  amount: number;
  sol: number;
  usd: number;
  side: "buy" | "sell";
  time: number;
};

export function loadBook(mint: string): Promise<{ rows: BookPrint[]; msg?: string }> {
  return remember(`book:${mint}`, 3_000, () => fetchBook(mint)).catch(() => ({
    rows: [],
    msg: "The order book could not be loaded.",
  }));
}

export function loadUsdPrice(mint: string): Promise<number | null> {
  return remember(`stats:${mint}`, 30_000, () => loadStats(mint))
    .then((stats) => stats.price)
    .catch(() => null);
}

export function loadSide(mint: string, range: string): Promise<ChartSide> {
  const spec = RANGES[range] ?? RANGES["1D"];
  return Promise.allSettled([
    remember(`ohlcv:${mint}:${range}`, 30_000, () => loadCandles(mint, spec)),
    remember(`stats:${mint}`, 30_000, () => loadStats(mint)),
  ]).then(([candlesResult, statsResult]) => {
    const candles = candlesResult.status === "fulfilled" ? candlesResult.value : { candles: [], msg: "The chart could not be loaded." };
    const stats = statsResult.status === "fulfilled" ? statsResult.value : emptyStats();
    const last = candles.candles[candles.candles.length - 1];
    const first = candles.candles[0];
    const change = first && last && first.open !== 0 ? ((last.close - first.open) / first.open) * 100 : null;
    return {
      candles: candles.candles,
      price: last?.close ?? stats.price,
      change,
      volume: stats.volume,
      mcap: stats.mcap,
      liquidity: stats.liquidity,
      holders: stats.holders,
      ...(candles.msg ? { msg: candles.msg } : {}),
    };
  });
}

function remember<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = fresh.get(key);
  if (hit && Date.now() < hit.until) return Promise.resolve(hit.value as T);
  return load().then((value) => {
    fresh.set(key, { until: Date.now() + ttlMs, value });
    return value;
  });
}

async function loadCandles(mint: string, spec: { interval: string; candles: number }) {
  const chart = await getJson<{ candles?: { time: number; open: number; high: number; low: number; close: number }[] }>(
    `https://datapi.jup.ag/v2/charts/${mint}?interval=${spec.interval}&to=${Date.now()}&candles=${spec.candles}&type=price`,
  );
  const candles = (chart.candles ?? [])
    .map((candle) => ({
      time: Math.floor(Number(candle.time)),
      open: Number(candle.open),
      high: Number(candle.high),
      low: Number(candle.low),
      close: Number(candle.close),
    }))
    .filter((candle) => candle.time > 0 && [candle.open, candle.high, candle.low, candle.close].every(Number.isFinite))
    .sort((left, right) => left.time - right.time);
  const unique = candles.filter((candle, index) => index === 0 || candle.time !== candles[index - 1].time);
  return unique.length ? { candles: unique } : { candles: [], msg: "No prices for this range." };
}

async function loadStats(mint: string) {
  const list = await getJson<JupiterToken[]>(`https://lite-api.jup.ag/tokens/v2/search?query=${mint}`);
  const token = (Array.isArray(list) ? list : []).find((item) => item.id === mint) ?? (Array.isArray(list) ? list[0] : undefined);
  if (!token) return emptyStats();
  const buy = num(token.stats24h?.buyVolume);
  const sell = num(token.stats24h?.sellVolume);
  const volume = buy !== null || sell !== null ? (buy ?? 0) + (sell ?? 0) : null;
  return {
    price: num(token.usdPrice),
    mcap: num(token.mcap),
    liquidity: num(token.liquidity),
    holders: num(token.holderCount),
    volume,
  };
}

function emptyStats() {
  return { price: null, mcap: null, liquidity: null, holders: null, volume: null };
}

type JupiterTx = {
  txHash?: string;
  actionId?: string;
  type?: string;
  usdVolume?: number;
  nativeVolume?: number;
  usdPrice?: number;
  amount?: number;
  timestamp?: string;
  isMev?: boolean;
};

async function fetchBook(mint: string): Promise<{ rows: BookPrint[]; msg?: string }> {
  const body = await getJson<{ txs?: JupiterTx[] }>(`https://datapi.jup.ag/v1/txs/${mint}?limit=50`);
  const rows = (body.txs ?? [])
    .filter((tx) => (tx.type === "buy" || tx.type === "sell") && !tx.isMev && tx.txHash)
    .map((tx) => ({
      id: tx.txHash as string,
      seq: tx.actionId ?? "0",
      price: num(tx.usdPrice) ?? 0,
      amount: num(tx.amount) ?? 0,
      sol: num(tx.nativeVolume) ?? 0,
      usd: num(tx.usdVolume) ?? 0,
      side: tx.type === "sell" ? ("sell" as const) : ("buy" as const),
      time: Date.parse(tx.timestamp ?? ""),
    }))
    .filter((row) => row.price > 0 && row.amount > 0 && row.usd > 0 && Number.isFinite(row.time))
    .sort((a, b) => (a.seq < b.seq ? 1 : a.seq > b.seq ? -1 : 0));
  return rows.length ? { rows } : { rows: [], msg: "No recent trades for this token." };
}

const paused = new Map<string, number>();

async function getJson<T>(url: string): Promise<T> {
  const host = new URL(url).host;
  const until = paused.get(host) ?? 0;
  if (Date.now() < until) throw new Error("The price service asked for a short pause.");
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "goblock" },
    cache: "no-store",
  });
  if (response.status === 429) {
    paused.set(host, Date.now() + 20_000);
    throw new Error("The price service asked for a short pause.");
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as T;
}

function num(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
