import { NextRequest, NextResponse } from "next/server";
import { issueFreeKey, requireKey, type KeyPlan } from "@/lib/access";
import { freeFeeRows } from "@/lib/fees";
import { ensureOperator, operator } from "@/lib/operator";

function terms(plan: KeyPlan) {
  const live = operator();
  return {
    plan,
    fees: plan === "paid" ? [{ pair: "Every pair", bps: 0 }] : freeFeeRows(),
    feeToken: "SOL",
    platformFee: { minBps: live.platformMinBps, maxBps: live.platformMaxBps, goblockShare: "10%" },
    endpoints: ["/api/v1/swap"],
  };
}

export async function GET(request: NextRequest) {
  const access = await requireKey(request);
  if (access instanceof NextResponse) return access;
  return NextResponse.json({
    active: true,
    ...terms(access.plan),
    limit: access.rpm === null ? "No per-minute cap on this key." : `${access.rpm} requests / min`,
  });
}

export async function POST(request: NextRequest) {
  const issued = issueFreeKey(request);
  if (issued instanceof NextResponse) return issued;
  await ensureOperator();
  return NextResponse.json({ key: issued.key, ...terms("free"), limit: `${operator().freeRpm} requests / min` }, { status: 201 });
}
