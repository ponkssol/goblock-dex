"use client";

import { useEffect, useState } from "react";
import { Legend, Sparkline, UsageChart } from "./chart";
import { average, count, dayLabel, percent } from "./format";
import { Icon } from "./icons";
import { dashboardApi, type Day } from "./session";
import { Card, Kpi, PageHead, useLoaded } from "./shell";

const RANGES = [7, 14, 30] as const;

export function UsageView() {
  const { overview, session, placeholder } = useLoaded();
  const [range, setRange] = useState<(typeof RANGES)[number]>(30);
  const [key, setKey] = useState("all");
  const [keyDays, setKeyDays] = useState<Day[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (key === "all") {
      setKeyDays(null);
      return;
    }
    let alive = true;
    setKeyDays(null);
    dashboardApi<{ usage: Day[] }>(`usage?key=${key}`, session.token)
      .then((body) => alive && (setKeyDays(body.usage), setError("")))
      .catch((caught) => alive && setError(caught instanceof Error ? caught.message : "Usage could not be loaded."));
    return () => {
      alive = false;
    };
  }, [key, session.token]);

  if (!overview) return placeholder;

  const source = key === "all" ? overview.usage : keyDays ?? [];
  const days = source.slice(-range);
  const total = days.reduce((sum, day) => sum + day.requests, 0);
  const failed = days.reduce((sum, day) => sum + day.errors, 0);
  const busiest = days.reduce<Day | null>((best, day) => (!best || day.requests > best.requests ? day : best), null);
  const byKey = [...overview.keys].sort((a, b) => b.requests30d - a.requests30d);
  const keyPeak = Math.max(1, ...byKey.map((item) => item.requests30d));

  return (
    <>
      <PageHead title="Usage" sub="Every call to /api/v1/swap made with your keys, counted per day in UTC.">
        <label className="ds-select">
          <span className="sr-only">Key</span>
          <select value={key} onChange={(event) => setKey(event.target.value)}>
            <option value="all">All keys</option>
            {overview.keys.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
                {item.revokedAt ? " (revoked)" : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="m-seg ds-seg" role="tablist" aria-label="Range">
          {RANGES.map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={range === value}
              className={range === value ? "on" : undefined}
              onClick={() => setRange(value)}
            >
              {value}D
            </button>
          ))}
        </div>
      </PageHead>

      {error ? <p className="b-error">{error}</p> : null}

      <ul className="ds-kpis five">
        <Kpi icon="usage" label="Requests" value={count(total)} foot={`Last ${range} days`}>
          <Sparkline values={days.map((day) => day.requests)} />
        </Kpi>
        <Kpi icon="shield" label="Errors" value={count(failed)} foot="Status 400 and above" tone={failed ? "down" : undefined} />
        <Kpi icon="check" label="Success rate" value={percent(total - failed, total)} foot="Answered without an error" />
        <Kpi icon="overview" label="Daily average" value={average(total, range)} foot="Requests per day" />
        <Kpi
          icon="arrow"
          label="Busiest day"
          value={busiest && busiest.requests ? dayLabel(busiest.day) : "—"}
          foot={busiest && busiest.requests ? `${count(busiest.requests)} requests` : "No requests yet"}
        />
      </ul>

      <Card title="Requests per day" sub={key === "all" ? "All keys" : overview.keys.find((item) => item.id === key)?.label} action={<Legend />}>
        {days.length ? <UsageChart days={days} /> : <div className="ds-loading slim"><i /></div>}
      </Card>

      <div className="ds-grid c-1-1">
        <Card title="By key" sub="Requests in the last 30 days">
          {byKey.length ? (
            <ul className="ds-bars">
              {byKey.map((item) => (
                <li key={item.id} className={item.revokedAt ? "off" : undefined}>
                  <div>
                    <b>{item.label}</b>
                    <span>{count(item.requests30d)}</span>
                  </div>
                  <i>
                    <em style={{ width: `${(item.requests30d / keyPeak) * 100}%` }} />
                  </i>
                </li>
              ))}
            </ul>
          ) : (
            <div className="ds-empty">
              <Icon name="usage" size={22} />
              <b>Nothing to show yet</b>
              <p>Usage appears here once a key makes its first request.</p>
            </div>
          )}
        </Card>

        <Card plain title="Daily log" sub={`Last ${range} days, newest first`}>
          <div className="ds-scroll">
            <table className="ds-table">
              <thead>
                <tr>
                  <th>Day</th>
                  <th className="num">Requests</th>
                  <th className="num">Errors</th>
                  <th className="num">Success</th>
                </tr>
              </thead>
              <tbody>
                {[...days].reverse().map((day) => (
                  <tr key={day.day} className={day.requests ? undefined : "quiet"}>
                    <td>{dayLabel(day.day)}</td>
                    <td className="num">{count(day.requests)}</td>
                    <td className="num">{count(day.errors)}</td>
                    <td className="num">{day.requests ? percent(day.requests - day.errors, day.requests) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
