import { NextRequest, NextResponse } from "next/server";
import { loadUsdPrice } from "@/lib/market";
import { isMint } from "@/lib/tokens";

export async function GET(request: NextRequest) {
  const mint = request.nextUrl.searchParams.get("mint") ?? "";
  if (!isMint(mint)) {
    return NextResponse.json({ msg: "That mint is not valid." }, { status: 400 });
  }
  const usd = await loadUsdPrice(mint);
  if (usd === null) {
    return NextResponse.json({ msg: "No USD price for this token." }, { status: 404 });
  }
  return NextResponse.json({ mint, usd });
}
