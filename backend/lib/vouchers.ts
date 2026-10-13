import { sql } from "./db";
import type { CheckoutPlanId } from "./plans";

export class VoucherError extends Error {}

export type Voucher = {
  code: string;
  percent: number | null;
  usdOff: number | null;
  maxUses: number | null;
  used: number;
  plan: string | null;
  expiresAt: string | null;
  active: boolean;
};

type Row = {
  code: string;
  percent: number | null;
  usd_off: number | null;
  max_uses: number | null;
  used: number;
  plan: string | null;
  expires_at: string | Date | null;
  active: boolean | string;
};

let pending: Promise<void> | null = null;

function ready() {
  pending ??= sql(
    `create table if not exists vouchers (
      code text primary key,
      percent integer,
      usd_off integer,
      max_uses integer,
      used integer not null default 0,
      plan text,
      expires_at timestamptz,
      active boolean not null default true,
      created_at timestamptz not null default now()
    )`,
  )
    .then(() => undefined)
    .catch((error) => {
      pending = null;
      throw error;
    });
  return pending;
}

export function cleanCode(value: string): string {
  return value.trim().toUpperCase().replace(/[\s-]+/g, "");
}

export function dueUsd(list: number, voucher: { percent: number | null; usdOff: number | null }): number {
  const raw = voucher.percent != null ? (list * (100 - voucher.percent)) / 100 : list - (voucher.usdOff ?? 0);
  return Math.max(0, Math.round(raw * 100) / 100);
}

export function voucherLabel(voucher: { percent: number | null; usdOff: number | null }): string {
  return voucher.percent != null ? `${voucher.percent}% off` : `$${voucher.usdOff} off`;
}

function stamp(value: string | Date | null): string | null {
  if (!value) return null;
  const time = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function mapRow(row: Row): Voucher {
  return {
    code: row.code,
    percent: row.percent == null ? null : Number(row.percent),
    usdOff: row.usd_off == null ? null : Number(row.usd_off),
    maxUses: row.max_uses == null ? null : Number(row.max_uses),
    used: Number(row.used),
    plan: row.plan,
    expiresAt: stamp(row.expires_at),
    active: row.active === true || row.active === "t" || row.active === "true",
  };
}

function rejection(voucher: Voucher, plan: string, now = Date.now()): string {
  if (!voucher.active) return "That code is not valid.";
  if (voucher.expiresAt && Date.parse(voucher.expiresAt) <= now) return "That code has expired.";
  if (voucher.maxUses != null && voucher.used >= voucher.maxUses) return "That code has been used up.";
  if (voucher.plan && voucher.plan !== plan) return `That code applies to the ${voucher.plan === "builder" ? "Builder" : "Starter"} plan.`;
  return "";
}

export async function lookupVoucher(raw: string, plan: string): Promise<{ voucher: Voucher | null; error: string }> {
  await ready();
  const code = cleanCode(raw);
  if (!/^[A-Z0-9]{4,16}$/.test(code)) return { voucher: null, error: "That code is not valid." };
  const [row] = await sql<Row>("select * from vouchers where code = $1", [code]);
  if (!row) return { voucher: null, error: "That code is not valid." };
  const voucher = mapRow(row);
  const error = rejection(voucher, plan);
  return { voucher: error ? null : voucher, error };
}

/** Counts one use. Throws when the code can no longer be redeemed. */
export async function claimVoucher(raw: string, plan: CheckoutPlanId): Promise<void> {
  await ready();
  const code = cleanCode(raw);
  const [row] = await sql<{ code: string }>(
    `update vouchers set used = used + 1
     where code = $1 and active
       and (expires_at is null or expires_at > now())
       and (max_uses is null or used < max_uses)
       and (plan is null or plan = $2)
     returning code`,
    [code, plan],
  );
  if (!row) throw new VoucherError("That code can no longer be used. Refresh the price.");
}

export async function releaseVoucher(raw: string): Promise<void> {
  await ready();
  await sql("update vouchers set used = greatest(used - 1, 0) where code = $1", [cleanCode(raw)]);
}

export async function listVouchers(): Promise<Voucher[]> {
  await ready();
  const rows = await sql<Row>("select * from vouchers order by created_at desc");
  return rows.map(mapRow);
}

export async function createVoucher(input: {
  code?: unknown;
  percent?: unknown;
  usdOff?: unknown;
  maxUses?: unknown;
  plan?: unknown;
  days?: unknown;
}): Promise<Voucher> {
  await ready();
  const code = cleanCode(typeof input.code === "string" ? input.code : "");
  if (!/^[A-Z0-9]{4,16}$/.test(code)) throw new VoucherError("Use 4 to 16 letters or numbers.");
  const percent = input.percent == null || input.percent === "" ? null : Number(input.percent);
  const usdOff = input.usdOff == null || input.usdOff === "" ? null : Number(input.usdOff);
  if ((percent == null) === (usdOff == null)) throw new VoucherError("Set a percent or a dollar amount, not both.");
  if (percent != null && (!Number.isInteger(percent) || percent < 1 || percent > 100)) {
    throw new VoucherError("Percent must be a whole number from 1 to 100.");
  }
  if (usdOff != null && (!Number.isInteger(usdOff) || usdOff < 1 || usdOff > 98)) {
    throw new VoucherError("The dollar amount must be a whole number from 1 to 98.");
  }
  const plan = input.plan == null || input.plan === "" || input.plan === "any" ? null : input.plan;
  if (plan != null && plan !== "builder" && plan !== "starter") throw new VoucherError("Choose Builder, Starter, or any plan.");
  let maxUses: number | null = null;
  if (input.maxUses != null && input.maxUses !== "") {
    maxUses = Number(input.maxUses);
    if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 10_000) {
      throw new VoucherError("Uses must be a whole number from 1 to 10000, or empty for no limit.");
    }
  }
  let expires: string | null = null;
  if (input.days != null && input.days !== "") {
    const days = Number(input.days);
    if (!Number.isInteger(days) || days < 1 || days > 365) throw new VoucherError("Expiry must be 1 to 365 days.");
    expires = new Date(Date.now() + days * 86_400_000).toISOString();
  }
  try {
    const [row] = await sql<Row>(
      `insert into vouchers (code, percent, usd_off, max_uses, plan, expires_at)
       values ($1, $2, $3, $4, $5, $6)
       returning *`,
      [code, percent, usdOff, maxUses, plan, expires],
    );
    return mapRow(row);
  } catch (error) {
    const text = error instanceof Error ? error.message : "";
    if (/duplicate|unique/i.test(text)) throw new VoucherError("That code already exists.");
    throw error;
  }
}

export async function disableVoucher(raw: string): Promise<void> {
  await ready();
  const code = cleanCode(raw);
  const [row] = await sql<{ code: string }>("update vouchers set active = false where code = $1 returning code", [code]);
  if (!row) throw new VoucherError("That code was not found.");
}
