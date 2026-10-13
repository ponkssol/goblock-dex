import { sql } from "./db";

export type Operator = {
  builderUsd: number;
  starterUsd: number;
  freeRpm: number;
  builderRpm: number;
  starterRpm: number;
  stableBps: number;
  majorBps: number;
  otherBps: number;
  curveBps: number;
  brandBps: number;
  platformMinBps: number;
  platformMaxBps: number;
};

export const OPERATOR_DEFAULTS: Operator = {
  builderUsd: 20,
  starterUsd: 99,
  freeRpm: 10,
  builderRpm: 30,
  starterRpm: 120,
  stableBps: 0,
  majorBps: 3,
  otherBps: 5,
  curveBps: 20,
  brandBps: 5,
  platformMinBps: 50,
  platformMaxBps: 255,
};

export class OperatorError extends Error {}

type Row = {
  builder_usd: number;
  starter_usd: number;
  free_rpm: number;
  builder_rpm: number;
  starter_rpm: number;
  stable_bps: number;
  major_bps: number;
  other_bps: number;
  curve_bps: number;
  brand_bps: number;
  platform_min_bps: number;
  platform_max_bps: number;
};

let cache: Operator | null = null;
let pending: Promise<Operator> | null = null;

function shape(row: Row): Operator {
  return {
    builderUsd: row.builder_usd,
    starterUsd: row.starter_usd,
    freeRpm: row.free_rpm,
    builderRpm: row.builder_rpm,
    starterRpm: row.starter_rpm,
    stableBps: row.stable_bps,
    majorBps: row.major_bps,
    otherBps: row.other_bps,
    curveBps: row.curve_bps,
    brandBps: row.brand_bps,
    platformMinBps: row.platform_min_bps,
    platformMaxBps: row.platform_max_bps,
  };
}

async function ensureTable() {
  await sql(
    `create table if not exists operator_settings (
       id text primary key,
       builder_usd integer not null,
       starter_usd integer not null,
       free_rpm integer not null,
       builder_rpm integer not null,
       starter_rpm integer not null,
       stable_bps integer not null,
       major_bps integer not null,
       other_bps integer not null,
       curve_bps integer not null,
       brand_bps integer not null,
       platform_min_bps integer not null,
       platform_max_bps integer not null,
       updated_at timestamptz not null default now()
     )`,
  );
}

/** The last loaded settings. Defaults until the first successful read. */
export function operator(): Operator {
  return cache ?? OPERATOR_DEFAULTS;
}

export function ensureOperator(): Promise<Operator> {
  if (cache) return Promise.resolve(cache);
  pending ??= load().finally(() => {
    pending = null;
  });
  return pending;
}

async function load(): Promise<Operator> {
  await ensureTable();
  const [row] = await sql<Row>(
    `select builder_usd, starter_usd, free_rpm, builder_rpm, starter_rpm,
            stable_bps, major_bps, other_bps, curve_bps, brand_bps, platform_min_bps, platform_max_bps
     from operator_settings where id = 'live'`,
  );
  cache = row ? shape(row) : { ...OPERATOR_DEFAULTS };
  if (!row) await write(cache);
  return cache;
}

async function write(next: Operator) {
  await sql(
    `insert into operator_settings (
       id, builder_usd, starter_usd, free_rpm, builder_rpm, starter_rpm,
       stable_bps, major_bps, other_bps, curve_bps, brand_bps, platform_min_bps, platform_max_bps
     ) values ('live', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     on conflict (id) do update set
       builder_usd = excluded.builder_usd,
       starter_usd = excluded.starter_usd,
       free_rpm = excluded.free_rpm,
       builder_rpm = excluded.builder_rpm,
       starter_rpm = excluded.starter_rpm,
       stable_bps = excluded.stable_bps,
       major_bps = excluded.major_bps,
       other_bps = excluded.other_bps,
       curve_bps = excluded.curve_bps,
       brand_bps = excluded.brand_bps,
       platform_min_bps = excluded.platform_min_bps,
       platform_max_bps = excluded.platform_max_bps,
       updated_at = now()`,
    [
      next.builderUsd,
      next.starterUsd,
      next.freeRpm,
      next.builderRpm,
      next.starterRpm,
      next.stableBps,
      next.majorBps,
      next.otherBps,
      next.curveBps,
      next.brandBps,
      next.platformMinBps,
      next.platformMaxBps,
    ],
  );
}

function whole(value: unknown, min: number, max: number, label: string): number {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new OperatorError(`${label} must be a whole number from ${min} to ${max}.`);
  }
  return n;
}

export async function saveOperator(input: Record<string, unknown>): Promise<Operator> {
  const next: Operator = {
    builderUsd: whole(input.builderUsd, 1, 10_000, "Builder price"),
    starterUsd: whole(input.starterUsd, 1, 10_000, "Starter price"),
    freeRpm: whole(input.freeRpm, 1, 10_000, "Free rate limit"),
    builderRpm: whole(input.builderRpm, 1, 10_000, "Builder rate limit"),
    starterRpm: whole(input.starterRpm, 1, 10_000, "Starter rate limit"),
    stableBps: whole(input.stableBps, 0, 255, "Stablecoin fee"),
    majorBps: whole(input.majorBps, 0, 255, "Major-token fee"),
    otherBps: whole(input.otherBps, 0, 255, "Other-token fee"),
    curveBps: whole(input.curveBps, 0, 255, "Bonding-curve fee"),
    brandBps: whole(input.brandBps, 0, 255, "Brand-link fee"),
    platformMinBps: whole(input.platformMinBps, 1, 255, "Minimum platform fee"),
    platformMaxBps: whole(input.platformMaxBps, 1, 255, "Maximum platform fee"),
  };
  if (next.starterRpm < next.builderRpm) throw new OperatorError("The Starter cap must be at least the Builder cap.");
  if (next.platformMaxBps < next.platformMinBps) {
    throw new OperatorError("The maximum platform fee must be at least the minimum.");
  }
  await ensureTable();
  await write(next);
  cache = next;
  return next;
}
