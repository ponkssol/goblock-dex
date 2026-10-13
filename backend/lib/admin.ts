import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "./session";
import { sql } from "./db";
import { listWaitlist, ensureWaitlist } from "./waitlist";

/** Upgrade authority of program GBLK6CfBQXsTjYZqzpNs5gxYjp8r3NqnqZiohjuvxMww. */
export const DEPLOYER_WALLET = "GoBLK9ujNfaaoap2mYr2wA6j4okNcw29K9RTBozrt7zg";

export function requireDeployer(request: NextRequest): string | NextResponse {
  const wallet = requireSession(request);
  if (wallet instanceof NextResponse) return wallet;
  if (wallet !== DEPLOYER_WALLET) {
    return NextResponse.json({ msg: "Only the program deployer can open the admin console." }, { status: 403 });
  }
  return wallet;
}

const iso = (value: Date | string | null) => (value === null ? null : new Date(value).toISOString());

export async function listPayments(limit = 200) {
  const rows = await sql<{
    signature: string;
    wallet: string;
    plan: string;
    asset: string;
    amount: string;
    key_id: string;
    created_at: Date | string;
  }>(
    `select signature, wallet, plan, asset, amount, key_id, created_at
     from checkouts
     order by created_at desc
     limit $1`,
    [limit],
  );
  return rows.map((row) => ({
    signature: row.signature,
    wallet: row.wallet,
    plan: row.plan,
    asset: row.asset,
    amount: row.amount,
    keyId: row.key_id,
    createdAt: iso(row.created_at),
  }));
}

export async function adminOverview() {
  await ensureWaitlist();
  const [counts] = await sql<{
    keys: number;
    active_keys: number;
    payments: number;
    waiting: number;
    codes: number;
    requests_today: number;
  }>(
    `select
       (select count(*)::int from api_keys) as keys,
       (select count(*)::int from api_keys where revoked_at is null) as active_keys,
       (select count(*)::int from checkouts) as payments,
       (select count(*)::int from waitlist) as waiting,
       (select count(*)::int from vouchers where active) as codes,
       (select coalesce(sum(requests), 0)::int from api_usage where day = (now() at time zone 'utc')::date) as requests_today`,
  );
  const [payments, waitlist] = await Promise.all([listPayments(8), listWaitlist(8)]);
  return {
    keys: counts?.keys ?? 0,
    activeKeys: counts?.active_keys ?? 0,
    payments: counts?.payments ?? 0,
    waiting: counts?.waiting ?? 0,
    codes: counts?.codes ?? 0,
    requestsToday: counts?.requests_today ?? 0,
    recentPayments: payments,
    recentWaitlist: waitlist,
  };
}
