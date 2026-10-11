import { NextRequest, NextResponse } from "next/server";
import { rejectWithoutKey } from "@/lib/access";

export async function GET(request: NextRequest) {
  const denied = rejectWithoutKey(request);
  if (denied) return denied;
  return NextResponse.json({
    active: true,
    swapFeeBps: 0,
    endpoints: ["/api/v1/swap"],
    limit: "Shared allowlist. Per-plan request caps start when subscription checkout ships.",
  });
}
