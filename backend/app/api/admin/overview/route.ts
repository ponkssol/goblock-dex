import { NextRequest, NextResponse } from "next/server";
import { adminOverview, requireDeployer } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const wallet = requireDeployer(request);
  if (wallet instanceof NextResponse) return wallet;
  try {
    return NextResponse.json(await adminOverview(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("admin overview failed", error);
    return NextResponse.json({ msg: "The admin console could not be loaded." }, { status: 503 });
  }
}
