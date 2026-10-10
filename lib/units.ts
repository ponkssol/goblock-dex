export function toAtomic(amount: string, decimals: number): string | null {
  const trimmed = amount.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const [whole, fraction = ""] = trimmed.split(".");
  if (fraction.length > decimals) return null;
  const combined = `${whole}${fraction.padEnd(decimals, "0")}`.replace(/^0+/, "");
  return combined.length > 0 ? combined : null;
}

export function formatAtomic(amount: string, decimals: number, maxFraction = 6): string {
  const negative = amount.startsWith("-");
  const raw = negative ? amount.slice(1) : amount;
  const padded = raw.padStart(decimals + 1, "0");
  const whole = padded.slice(0, padded.length - decimals);
  const fraction = padded.slice(padded.length - decimals, padded.length - decimals + maxFraction).replace(/0+$/, "");
  const text = fraction ? `${whole}.${fraction}` : whole;
  return negative ? `-${text}` : text;
}

export function formatImpact(priceImpactPct: string): string {
  const value = Number(priceImpactPct);
  if (!Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(3)}%`;
}

export function shorten(value: string, left = 4, right = 4): string {
  if (value.length <= left + right + 1) return value;
  return `${value.slice(0, left)}…${value.slice(-right)}`;
}
