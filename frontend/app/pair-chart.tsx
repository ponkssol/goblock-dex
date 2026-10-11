"use client";

import { useEffect, useRef, useState } from "react";
import {
  AreaSeries,
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { TokenInfo } from "@/lib/tokens";

const RANGES = ["1H", "4H", "1D", "1W"] as const;

type Candle = { time: number; open: number; high: number; low: number; close: number };

type Side = {
  candles: Candle[];
  price: number | null;
  change: number | null;
  volume: number | null;
  mcap: number | null;
  liquidity: number | null;
  holders: number | null;
  msg?: string;
};

type ChartBody = { pay?: Side; receive?: Side; msg?: string };

const LINE = {
  lineColor: "#c7f284",
  topColor: "rgba(199, 242, 132, 0.42)",
  bottomColor: "rgba(199, 242, 132, 0.04)",
  relativeGradient: true,
  lineWidth: 2 as const,
  priceLineVisible: false,
  crosshairMarkerRadius: 3,
  crosshairMarkerBackgroundColor: "#c7f284",
  crosshairMarkerBorderColor: "#c7f284",
};

export function PairChart({ active, pay, receive }: { active: boolean; pay: TokenInfo; receive: TokenInfo }) {
  const plotRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<{ chart: IChartApi; top: ISeriesApi<"Area">; bottom: ISeriesApi<"Area"> } | null>(null);
  const [range, setRange] = useState<(typeof RANGES)[number]>("1D");
  const [data, setData] = useState<ChartBody | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!active) return;
    const el = plotRef.current;
    if (!el) return;
    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#7a7a7b",
        fontSize: 11,
        attributionLogo: true,
        panes: {
          enableResize: false,
          separatorColor: "rgba(199, 242, 132, 0.16)",
          separatorHoverColor: "rgba(199, 242, 132, 0.28)",
        },
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 0,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      crosshair: {
        vertLine: { color: "rgba(199, 242, 132, 0.35)", labelBackgroundColor: "#080809" },
        horzLine: { color: "rgba(199, 242, 132, 0.35)", labelBackgroundColor: "#080809" },
      },
    });
    const top = chart.addSeries(AreaSeries, LINE, 0);
    const bottom = chart.addSeries(AreaSeries, LINE, 1);
    const panes = chart.panes();
    panes[0]?.setStretchFactor(1);
    panes[1]?.setStretchFactor(1);
    for (const pane of panes) {
      pane.priceScale("right").applyOptions({ scaleMargins: { top: 0.14, bottom: 0 }, borderVisible: false });
    }
    apiRef.current = { chart, top, bottom };
    return () => {
      chart.remove();
      apiRef.current = null;
    };
  }, [active]);

  const fitted = useRef(false);

  useEffect(() => {
    fitted.current = false;
  }, [pay.mint, receive.mint, range]);

  useEffect(() => {
    if (!active) return;
    let alive = true;
    let controller = new AbortController();
    const load = (quiet: boolean) => {
      controller.abort();
      controller = new AbortController();
      if (!quiet) {
        setLoading(true);
        setMsg("");
      }
      const params = new URLSearchParams({ pay: pay.mint, receive: receive.mint, range });
      fetch(`/api/chart?${params}`, { signal: controller.signal })
        .then((response) => response.json() as Promise<ChartBody>)
        .then((body) => {
          if (!alive) return;
          setData(body);
          if (!quiet) setMsg(body.msg ?? body.pay?.msg ?? body.receive?.msg ?? "");
        })
        .catch((error: unknown) => {
          if (!alive || (error instanceof DOMException && error.name === "AbortError")) return;
          if (!quiet) setMsg("The chart could not be loaded.");
        })
        .finally(() => {
          if (alive && !quiet) setLoading(false);
        });
    };
    load(false);
    const poll = setInterval(() => load(true), 12_000);
    return () => {
      alive = false;
      controller.abort();
      clearInterval(poll);
    };
  }, [active, pay.mint, receive.mint, range]);

  useEffect(() => {
    const api = apiRef.current;
    if (!api || !data?.pay || !data.receive) return;
    api.top.setData(toSeries(data.pay.candles));
    api.bottom.setData(toSeries(data.receive.candles));
    if (!fitted.current && (data.pay.candles.length || data.receive.candles.length)) {
      api.chart.timeScale().fitContent();
      fitted.current = true;
    }
  }, [data, active]);

  const paySide = data?.pay;
  const receiveSide = data?.receive;

  return (
    <div className="chart-card">
      <header className="chart-head">
        <strong>
          {pay.symbol}
          <span> / </span>
          {receive.symbol}
        </strong>
        <div className="ranges">
          {RANGES.map((item) => (
            <button key={item} type="button" className={item === range ? "on" : undefined} onClick={() => setRange(item)}>
              {item}
            </button>
          ))}
        </div>
      </header>
      <div className="plots">
        <div ref={plotRef} className="plot" />
        <p className="pane-tag pay">
          <strong>{pay.symbol}</strong>
          <em className={signed(paySide?.change)}>{formatChange(paySide?.change)}</em>
        </p>
        <p className="pane-tag receive">
          <strong>{receive.symbol}</strong>
          <em className={signed(receiveSide?.change)}>{formatChange(receiveSide?.change)}</em>
        </p>
        {loading && !paySide?.candles.length ? <p className="plot-note">Loading chart</p> : null}
        {!loading && msg && !paySide?.candles.length && !receiveSide?.candles.length ? <p className="plot-note">{msg}</p> : null}
      </div>
      <section className="stat-card" aria-label="Market stats">
        <div className="stat-head">
          <span />
          <span>Volume</span>
          <span>MCap</span>
          <span>Liquidity</span>
          <span>Holders</span>
        </div>
        <StatRow symbol={pay.symbol} side={paySide} />
        <StatRow symbol={receive.symbol} side={receiveSide} />
      </section>
    </div>
  );
}

function StatRow({ symbol, side }: { symbol: string; side?: Side }) {
  return (
    <div className="stat-row">
      <strong>{symbol}</strong>
      <span>{usd(side?.volume)}</span>
      <span>{usd(side?.mcap)}</span>
      <span>{usd(side?.liquidity)}</span>
      <span>{count(side?.holders)}</span>
    </div>
  );
}

function toSeries(candles: Candle[]) {
  return candles.map((candle) => ({ time: candle.time as UTCTimestamp, value: candle.close }));
}

function signed(change: number | null | undefined) {
  if (change === null || change === undefined || !Number.isFinite(change)) return "";
  return change < 0 ? "down" : "up";
}

function formatChange(change: number | null | undefined) {
  if (change === null || change === undefined || !Number.isFinite(change)) return "—";
  const sign = change > 0 ? "+" : "";
  return `${sign}${change.toFixed(2)}%`;
}

function usd(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1e12) return `$${(abs / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `$${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(abs / 1e3).toFixed(1)}K`;
  return `$${abs.toFixed(2)}`;
}

function count(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}
