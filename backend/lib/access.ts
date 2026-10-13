import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { sql } from "./db";
import { ensureOperator } from "./operator";
import { feePlan, rpmFor } from "./plans";

export type KeyPlan = "paid" | "free";
/** `id` is set for dashboard keys, whose use is counted. `rpm` is null when the key has no per-minute cap. */
export type KeyAccess = { plan: KeyPlan; id: string | null; rpm: number | null };

const FREE_PREFIX = "gb_free_";
const LIVE_PREFIX = "gb_live_";
const ROW_CACHE_MS = 15_000;
const ISSUE_WINDOW_MS = 60 * 60 * 1000;
const ISSUE_LIMIT = 5;
const issued = new Map<string, number[]>();
const rows = new Map<string, { plan: string; revoked: boolean; expiresAt: string | null; at: number }>();
const windows = new Map<string, number[]>();

function listed(name: string): string[] {
  return (process.env[name] ?? "")
    .split(",")
    .map((key) => key.trim())
    .filter((key) => key.length > 0);
}

export function keySecret(): string | null {
  const secret = process.env.GOBLOCK_KEY_SECRET?.trim() ?? "";
  return secret.length >= 32 ? secret : null;
}

function sign(secret: string, id: string): string {
  return createHmac("sha256", secret).update(id).digest("hex").slice(0, 32);
}

function signedId(body: string, scope: string): string | null {
  const secret = keySecret();
  if (!secret) return null;
  const [id, signature] = body.split("_");
  if (!id || !signature || !/^[0-9a-f]{24}$/.test(id)) return null;
  const expected = sign(secret, `${scope}${id}`);
  if (signature.length !== expected.length) return null;
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected)) ? id : null;
}

export function freeKeysEnabled(): boolean {
  return keySecret() !== null;
}

export function mintLiveKey(): { id: string; key: string } {
  const secret = keySecret();
  if (!secret) throw new Error("API keys are not enabled on this server.");
  const id = randomBytes(12).toString("hex");
  return { id, key: `${LIVE_PREFIX}${id}_${sign(secret, `live:${id}`)}` };
}

export function maskKey(id: string): string {
  return `${LIVE_PREFIX}${id.slice(0, 6)}…${id.slice(-4)}`;
}

export function forgetKey(id: string) {
  rows.delete(id);
}

async function liveRow(id: string) {
  const cached = rows.get(id);
  if (cached && Date.now() - cached.at < ROW_CACHE_MS) return cached;
  const [row] = await sql<{ plan: string; revoked: boolean; expires_at: Date | string | null }>(
    "select plan, revoked_at is not null as revoked, expires_at from api_keys where id = $1",
    [id],
  );
  if (!row) return null;
  const fresh = {
    plan: row.plan,
    revoked: row.revoked,
    expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
    at: Date.now(),
  };
  rows.set(id, fresh);
  if (rows.size > 5_000) rows.delete(rows.keys().next().value as string);
  return fresh;
}

export async function keyAccess(presented: string): Promise<KeyAccess | null> {
  await ensureOperator();
  if (!presented) return null;
  if (listed("GOBLOCK_API_KEYS").includes(presented)) return { plan: "paid", id: null, rpm: null };
  if (listed("GOBLOCK_BLOCKED_KEYS").includes(presented)) return null;
  if (presented.startsWith(LIVE_PREFIX)) {
    const id = signedId(presented.slice(LIVE_PREFIX.length), "live:");
    const row = id ? await liveRow(id) : null;
    if (!id || !row || row.revoked) return null;
    return { plan: feePlan(row.plan, row.expiresAt), id, rpm: rpmFor(row.plan, row.expiresAt) };
  }
  if (presented.startsWith(FREE_PREFIX) && signedId(presented.slice(FREE_PREFIX.length), "")) {
    return { plan: "free", id: null, rpm: rpmFor("free", null) };
  }
  return null;
}

export async function requireKey(request: NextRequest): Promise<KeyAccess | NextResponse> {
  try {
    const access = await keyAccess(request.headers.get("x-api-key")?.trim() ?? "");
    if (access) return access;
  } catch (error) {
    console.error("key lookup failed", error);
    return NextResponse.json({ msg: "Keys cannot be checked right now. Try again shortly." }, { status: 503 });
  }
  return NextResponse.json(
    { msg: "This API needs a key. Create one at /dashboard or with POST /api/v1/key, then send it in the x-api-key header." },
    { status: 401 },
  );
}

export function allowSwap(bucket: string, rpm: number): boolean {
  const now = Date.now();
  const recent = (windows.get(bucket) ?? []).filter((at) => now - at < 60_000);
  if (recent.length >= rpm) {
    windows.set(bucket, recent);
    return false;
  }
  recent.push(now);
  windows.set(bucket, recent);
  if (windows.size > 20_000) windows.delete(windows.keys().next().value as string);
  return true;
}

export function recordUse(id: string, status: number, feeWallet?: string) {
  const writes = [
    sql(
      `insert into api_usage (key_id, day, requests, errors)
       values ($1, (now() at time zone 'utc')::date, 1, $2)
       on conflict (key_id, day) do update
       set requests = api_usage.requests + 1, errors = api_usage.errors + excluded.errors`,
      [id, status >= 400 ? 1 : 0],
    ),
    sql("update api_keys set last_used_at = now() where id = $1", [id]),
  ];
  if (feeWallet) {
    writes.push(sql("insert into api_fee_wallets (key_id, wallet) values ($1, $2) on conflict do nothing", [id, feeWallet]));
  }
  void Promise.all(writes).catch((error) => console.error("usage write failed", error));
}

export function issueFreeKey(request: NextRequest): { key: string } | NextResponse {
  const secret = keySecret();
  if (!secret) return NextResponse.json({ msg: "Free keys are not enabled on this server." }, { status: 503 });
  const caller = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const recent = (issued.get(caller) ?? []).filter((at) => now - at < ISSUE_WINDOW_MS);
  if (recent.length >= ISSUE_LIMIT) {
    return NextResponse.json({ msg: "Too many keys from this address. Try again in an hour." }, { status: 429 });
  }
  issued.set(caller, [...recent, now]);
  if (issued.size > 5_000) issued.delete(issued.keys().next().value as string);
  const id = randomBytes(12).toString("hex");
  return { key: `${FREE_PREFIX}${id}_${sign(secret, id)}` };
}
