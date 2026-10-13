import { forgetKey, maskKey, mintLiveKey } from "./access";
import { sql } from "./db";

export const KEY_LIMIT = 5;
export const USAGE_DAYS = 30;

type KeyRow = {
  id: string;
  label: string;
  plan: string;
  created_at: Date | string;
  revoked_at: Date | string | null;
  last_used_at: Date | string | null;
  expires_at: Date | string | null;
  today: number;
  month: number;
};

const iso = (value: Date | string | null) => (value === null ? null : new Date(value).toISOString());

function shape(row: KeyRow) {
  return {
    id: row.id,
    label: row.label,
    plan: row.plan,
    masked: maskKey(row.id),
    createdAt: iso(row.created_at),
    revokedAt: iso(row.revoked_at),
    lastUsedAt: iso(row.last_used_at),
    expiresAt: iso(row.expires_at),
    requestsToday: row.today,
    requests30d: row.month,
  };
}

export function cleanLabel(value: unknown): string {
  const label = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (!label) return "My key";
  if (label.length > 40) throw new Error("Keep the label to 40 characters or fewer.");
  return label;
}

export async function listKeys(wallet: string) {
  const rows = await sql<KeyRow>(
    `select k.id, k.label, k.plan, k.created_at, k.revoked_at, k.last_used_at, k.expires_at,
       coalesce(sum(u.requests) filter (where u.day = (now() at time zone 'utc')::date), 0)::int as today,
       coalesce(sum(u.requests), 0)::int as month
     from api_keys k
     left join api_usage u on u.key_id = k.id and u.day > (now() at time zone 'utc')::date - $2::int
     where k.wallet = $1
     group by k.id
     order by k.revoked_at is not null, k.created_at desc
     limit 50`,
    [wallet, USAGE_DAYS],
  );
  return rows.map(shape);
}

async function activeCount(wallet: string): Promise<number> {
  const [row] = await sql<{ count: number }>(
    "select count(*)::int as count from api_keys where wallet = $1 and revoked_at is null",
    [wallet],
  );
  return row?.count ?? 0;
}

export async function createKey(wallet: string, label: string, plan = "free", expiresAt: Date | null = null) {
  if ((await activeCount(wallet)) >= KEY_LIMIT) {
    throw new Error(`A wallet can hold ${KEY_LIMIT} active keys. Revoke one first.`);
  }
  const { id, key } = mintLiveKey();
  await sql("insert into api_keys (id, wallet, label, plan, expires_at) values ($1, $2, $3, $4, $5)", [
    id,
    wallet,
    label,
    plan,
    expiresAt,
  ]);
  return { key, id, masked: maskKey(id), label, plan, expiresAt: expiresAt ? expiresAt.toISOString() : null };
}

export async function revokeKey(wallet: string, id: string) {
  const rows = await sql<{ id: string; label: string; plan: string }>(
    `update api_keys set revoked_at = now()
     where id = $1 and wallet = $2 and revoked_at is null
     returning id, label, plan`,
    [id, wallet],
  );
  forgetKey(id);
  if (!rows[0]) throw new Error("That key was not found or is already revoked.");
  return rows[0];
}

/** Revokes the old key and issues a new one with the same label and plan. */
export async function rotateKey(wallet: string, id: string) {
  const old = await revokeKey(wallet, id);
  return createKey(wallet, old.label, old.plan);
}

/** Daily totals for every key of a wallet, or for one of its keys. */
export async function usage(wallet: string, keyId?: string) {
  const rows = await sql<{ day: string; requests: number; errors: number }>(
    `select to_char(u.day, 'YYYY-MM-DD') as day, sum(u.requests)::int as requests, sum(u.errors)::int as errors
     from api_usage u
     join api_keys k on k.id = u.key_id
     where k.wallet = $1 and u.day > (now() at time zone 'utc')::date - $2::int and ($3::text is null or k.id = $3)
     group by u.day
     order by u.day`,
    [wallet, USAGE_DAYS, keyId ?? null],
  );
  const byDay = new Map(rows.map((row) => [row.day, row]));
  const today = new Date();
  return Array.from({ length: USAGE_DAYS }, (_, index) => {
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - (USAGE_DAYS - 1 - index)));
    const day = date.toISOString().slice(0, 10);
    const row = byDay.get(day);
    return { day, requests: row?.requests ?? 0, errors: row?.errors ?? 0 };
  });
}

/** Every key, for the program-deployer admin console. */
export async function listAllKeys() {
  const rows = await sql<KeyRow & { wallet: string }>(
    `select k.id, k.wallet, k.label, k.plan, k.created_at, k.revoked_at, k.last_used_at, k.expires_at,
       coalesce(sum(u.requests) filter (where u.day = (now() at time zone 'utc')::date), 0)::int as today,
       coalesce(sum(u.requests), 0)::int as month
     from api_keys k
     left join api_usage u on u.key_id = k.id and u.day > (now() at time zone 'utc')::date - $1::int
     group by k.id
     order by k.revoked_at is not null, k.created_at desc
     limit 200`,
    [USAGE_DAYS],
  );
  return rows.map((row) => ({ ...shape(row), wallet: row.wallet }));
}

/** Revoke any key. Only the admin route may call this. */
export async function revokeAnyKey(id: string) {
  const rows = await sql<{ id: string }>(
    `update api_keys set revoked_at = now()
     where id = $1 and revoked_at is null
     returning id`,
    [id],
  );
  forgetKey(id);
  if (!rows[0]) throw new Error("That key was not found or is already revoked.");
}

export async function feeWallets(wallet: string): Promise<string[]> {
  const rows = await sql<{ wallet: string }>(
    `select f.wallet, min(f.first_seen) as first_seen
     from api_fee_wallets f
     join api_keys k on k.id = f.key_id
     where k.wallet = $1
     group by f.wallet
     order by first_seen
     limit 5`,
    [wallet],
  );
  return rows.map((row) => row.wallet);
}
