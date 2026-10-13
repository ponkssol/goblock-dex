const DAY = 86_400_000;

export function ago(at: string | number | null) {
  if (at === null) return "Never";
  const ms = Date.now() - (typeof at === "number" ? at : Date.parse(at));
  if (ms < 60_000) return "Just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)} min ago`;
  if (ms < DAY) return `${Math.floor(ms / 3_600_000)} h ago`;
  return `${Math.floor(ms / DAY)} d ago`;
}

export function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function dayLabel(day: string) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function count(value: number) {
  return value.toLocaleString("en-US");
}

export function average(total: number, days: number) {
  return (total / days).toLocaleString("en-US", { maximumFractionDigits: total < days * 10 ? 1 : 0 });
}

export function percent(part: number, whole: number) {
  return whole ? `${((part / whole) * 100).toFixed(1)}%` : "—";
}

export function planName(plan: string) {
  return plan === "free" ? "Free" : plan.charAt(0).toUpperCase() + plan.slice(1);
}

export function sol(lamports: number, digits = 4) {
  return (lamports / 1e9).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: digits });
}

export function solscan(path: string) {
  return `https://solscan.io/${path}`;
}
