import { randomUUID } from "node:crypto";
import { sql } from "./db";
import { isMint } from "./tokens";

export class WaitlistError extends Error {}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let ready: Promise<void> | null = null;

export function ensureWaitlist() {
  ready ??= sql(
    `create table if not exists waitlist (
       id text primary key,
       email text not null,
       wallet text,
       created_at timestamptz not null default now()
     )`,
  )
    .then(() => sql("create unique index if not exists waitlist_email on waitlist (lower(email))"))
    .then(() => undefined)
    .catch((error) => {
      ready = null;
      throw error;
    });
  return ready;
}

const iso = (value: Date | string) => new Date(value).toISOString();

export async function joinWaitlist(emailRaw: unknown, walletRaw: unknown) {
  const email = typeof emailRaw === "string" ? emailRaw.trim().toLowerCase() : "";
  if (!EMAIL.test(email) || email.length > 120) throw new WaitlistError("Enter a valid email.");
  let wallet: string | null = null;
  if (typeof walletRaw === "string" && walletRaw.trim()) {
    wallet = walletRaw.trim();
    if (!isMint(wallet)) throw new WaitlistError("That wallet address is not valid.");
  }
  await ensureWaitlist();
  try {
    await sql("insert into waitlist (id, email, wallet) values ($1, $2, $3)", [randomUUID(), email, wallet]);
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    if (/duplicate|unique|23505/i.test(text)) throw new WaitlistError("This email is already on the list.");
    throw error;
  }
  return { ok: true as const };
}

export async function listWaitlist(limit = 200) {
  await ensureWaitlist();
  const rows = await sql<{ id: string; email: string; wallet: string | null; created_at: Date | string }>(
    "select id, email, wallet, created_at from waitlist order by created_at desc limit $1",
    [limit],
  );
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    wallet: row.wallet,
    createdAt: iso(row.created_at),
  }));
}

export async function removeWaitlist(id: string) {
  if (!id || id.length > 80) throw new WaitlistError("That entry was not found.");
  await ensureWaitlist();
  const rows = await sql<{ id: string }>("delete from waitlist where id = $1 returning id", [id]);
  if (!rows[0]) throw new WaitlistError("That entry was not found.");
}
