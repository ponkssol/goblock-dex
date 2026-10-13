import { count, dayLabel } from "./format";
import type { Day } from "./session";

export function UsageChart({ days }: { days: Day[] }) {
  const most = Math.max(2, ...days.map((day) => day.requests));
  const peak = most % 2 ? most + 1 : most;
  const width = 600;
  const height = 200;
  const slot = width / Math.max(days.length, 1);
  const ticks = days.length > 10 ? [0, Math.floor(days.length / 2), days.length - 1] : [0, days.length - 1];

  return (
    <div className="ds-chart">
      <div className="ds-chart-scale" aria-hidden="true">
        <span>{count(peak)}</span>
        <span>{count(peak / 2)}</span>
        <span>0</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="Requests per day">
        {[0, 0.5, 1].map((line) => (
          <line key={line} x1="0" x2={width} y1={line * (height - 1) + 0.5} y2={line * (height - 1) + 0.5} />
        ))}
        {days.map((day, index) => {
          const tall = (day.requests / peak) * (height - 8);
          const bad = (day.errors / peak) * (height - 8);
          const x = index * slot + slot * 0.2;
          const w = slot * 0.6;
          return (
            <g key={day.day}>
              <title>{`${dayLabel(day.day)}: ${count(day.requests)} requests, ${count(day.errors)} errors`}</title>
              <rect className="hit" x={index * slot} y="0" width={slot} height={height} />
              {day.requests ? <rect className="ok" x={x} y={height - Math.max(tall, 2)} width={w} height={Math.max(tall, 2)} rx="3" /> : null}
              {day.errors ? <rect className="bad" x={x} y={height - Math.max(bad, 2)} width={w} height={Math.max(bad, 2)} rx="3" /> : null}
            </g>
          );
        })}
      </svg>
      <div className="ds-chart-axis">
        {ticks.map((index) => (
          <span key={index}>{index === days.length - 1 ? "Today" : dayLabel(days[index].day)}</span>
        ))}
      </div>
    </div>
  );
}

export function Sparkline({ values }: { values: number[] }) {
  const peak = Math.max(1, ...values);
  const step = 100 / Math.max(values.length - 1, 1);
  const points = values.map((value, index) => `${(index * step).toFixed(2)},${(30 - (value / peak) * 26).toFixed(2)}`);
  return (
    <svg className="ds-spark" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true">
      <polyline className="fill" points={`0,32 ${points.join(" ")} 100,32`} />
      <polyline className="line" points={points.join(" ")} />
    </svg>
  );
}

export function Legend() {
  return (
    <div className="ds-legend">
      <span>
        <i className="ok" />
        Requests
      </span>
      <span>
        <i className="bad" />
        Errors
      </span>
    </div>
  );
}
