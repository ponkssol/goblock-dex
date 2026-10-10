"use client";

import { CandlestickSeries, ColorType, createChart, type IChartApi, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";
import { useEffect, useRef, useState } from "react";

const RANGES = ["1H", "4H", "1D", "1W"] as const;

type Candle = { time: number; open: number; high: number; low: number; close: number };

type ChartBody = {
  candles?: Candle[];
  price?: number | null;
  change?: number;
  msg?: string;
};

export function PriceChart({ mint, symbol, active }: { mint: string; symbol: string; active: boolean }) {
  const plot = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [range, setRange] = useState<(typeof RANGES)[number]>("1D");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [price, setPrice] = useState<number | null>(null);
  const [change, setChange] = useState(0);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!active || !plot.current) return;
    const next = createChart(plot.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#9aa1ab",
        fontFamily: "Plus Jakarta Sans, sans-serif",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.06)" },
        horzLines: { color: "rgba(255,255,255,0.06)" },
      },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.08)" },
      timeScale: { borderColor: "rgba(255,255,255,0.08)", timeVisible: true, secondsVisible: false },
      crosshair: { vertLine: { color: "rgba(255,255,255,0.18)" }, horzLine: { color: "rgba(255,255,255,0.18)" } },
    });
    series.current = next.addSeries(CandlestickSeries, {
      upColor: "#3ddc97",
      downColor: "#ff8d8d",
      borderUpColor: "#3ddc97",
      borderDownColor: "#ff8d8d",
      wickUpColor: "#3ddc97",
      wickDownColor: "#ff8d8d",
    });
    chart.current = next;
    return () => {
      next.remove();
      chart.current = null;
      series.current = null;
    };
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    setNote("");
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/chart?mint=${mint}&range=${range}`, { signal: controller.signal });
        const body = (await response.json()) as ChartBody;
        if (controller.signal.aborted) return;
        setCandles(body.candles ?? []);
        setPrice(body.price ?? null);
        setChange(body.change ?? 0);
        setNote(body.candles?.length ? "" : (body.msg ?? "No candles for this token yet."));
      } catch {
        if (!controller.signal.aborted) setNote("The chart could not be loaded.");
      }
    }, 0);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [active, mint, range]);

  useEffect(() => {
    if (!series.current || candles.length === 0) return;
    series.current.setData(
      candles.map((candle) => ({
        time: candle.time as UTCTimestamp,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      })),
    );
    chart.current?.timeScale().fitContent();
  }, [candles]);

  const up = change >= 0;

  return (
    <div className="chart-card">
      <header className="chart-head">
        <div>
          <strong>{symbol}</strong>
          <p className={up ? "up" : "down"}>
            {price === null ? "—" : `$${formatMoney(price)}`}
            <span>
              {up ? "+" : ""}
              {change.toFixed(2)}%
            </span>
          </p>
        </div>
        <div className="ranges" role="tablist" aria-label="Chart range">
          {RANGES.map((item) => (
            <button key={item} type="button" className={item === range ? "on" : undefined} onClick={() => setRange(item)}>
              {item}
            </button>
          ))}
        </div>
      </header>
      <div className="chart-plot" ref={plot} />
      {note ? <p className="chart-note">{note}</p> : null}
    </div>
  );
}

function formatMoney(value: number) {
  if (value >= 1000) return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (value >= 1) return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (value >= 0.01) return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return value.toLocaleString("en-US", { maximumFractionDigits: 8 });
}
