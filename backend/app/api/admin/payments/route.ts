import { NextRequest, NextResponse } from "next/server";
import { listPayments, requireDeployer } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const wallet = requireDeployer(request);
  if (wallet instanceof NextResponse) return wallet;
  try {
    return NextResponse.json({ payments: await listPayments() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("admin payments failed", error);
    return NextResponse.json({ msg: "Payments could not be loaded." }, { status: 503 });
  }
}
