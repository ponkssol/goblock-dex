import { NextRequest, NextResponse } from "next/server";
import { allowSwap, recordUse, requireKey } from "@/lib/access";
import { respondSwap } from "@/lib/swap-http";

export async function GET(request: NextRequest) {
  const access = await requireKey(request);
  if (access instanceof NextResponse) return access;
  const presented = request.headers.get("x-api-key")?.trim() ?? "";
  if (access.rpm !== null && !allowSwap(access.id ?? presented, access.rpm)) {
    return NextResponse.json(
      { msg: `This key is limited to ${access.rpm} requests a minute. Wait a moment and try again.` },
      { status: 429 },
    );
  }
  const response = await respondSwap(request, access.plan);
  if (access.id) {
    const params = request.nextUrl.searchParams;
    const feeWallet = response.ok && params.get("platformFeeBps") ? (params.get("feeWallet") ?? undefined) : undefined;
    recordUse(access.id, response.status, feeWallet);
  }
  return response;
}
