import { NextResponse } from "next/server";
import { BRAND_FEE_BPS, treasuryAddress } from "@/lib/fees";

export async function GET() {
  return NextResponse.json({
    treasury: treasuryAddress().toBase58(),
    brandFeeBps: BRAND_FEE_BPS,
  });
}
