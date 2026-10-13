import { mkdir } from "node:fs/promises";
import path from "node:path";

type Rows = { rows: Record<string, unknown>[] };
type Client = {
  query(sql: string, params?: unknown[]): Promise<Rows>;
  exec(sql: string): Promise<unknown>;
};

const SCHEMA = `
create table if not exists api_keys (
  id text primary key,
  wallet text not null,
  label text not null,
  plan text not null default 'free',
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_used_at timestamptz
);
create index if not exists api_keys_wallet on api_keys (wallet);
alter table api_keys add column if not exists expires_at timestamptz;
create table if not exists checkouts (
  signature text primary key,
  wallet text not null,
  plan text not null,
  asset text not null,
  amount text not null,
  key_id text not null,
  created_at timestamptz not null default now()
);
create table if not exists api_usage (
  key_id text not null,
  day date not null,
  requests integer not null default 0,
  errors integer not null default 0,
  primary key (key_id, day)
);
create table if not exists api_fee_wallets (
  key_id text not null,
  wallet text not null,
  first_seen timestamptz not null default now(),
  primary key (key_id, wallet)
);
create table if not exists vouchers (
  code text primary key,
  percent integer,
  usd_off integer,
  max_uses integer,
  used integer not null default 0,
  plan text,
  expires_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists waitlist (
  id text primary key,
  email text not null,
  wallet text,
  created_at timestamptz not null default now()
);
create unique index if not exists waitlist_email on waitlist (lower(email));
create table if not exists operator_settings (
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
);
`;

async function open(): Promise<Client> {
  const url = process.env.DATABASE_URL?.trim();
  if (url) {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: url, max: 5 });
    return { query: (sql, params) => pool.query(sql, params), exec: (sql) => pool.query(sql) };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const dir = path.join(process.cwd(), ".data", "pglite");
  await mkdir(dir, { recursive: true });
  const local = new PGlite(dir);
  return { query: (sql, params) => local.query(sql, params), exec: (sql) => local.exec(sql) };
}

const shared = globalThis as typeof globalThis & { goblockDb?: Promise<Client> };

function client(): Promise<Client> {
  shared.goblockDb ??= open()
    .then(async (db) => {
      await db.exec(SCHEMA);
      return db;
    })
    .catch((error) => {
      shared.goblockDb = undefined;
      throw error;
    });
  return shared.goblockDb;
}

export async function sql<T>(text: string, params: unknown[] = []): Promise<T[]> {
  const db = await client();
  return (await db.query(text, params)).rows as T[];
}
