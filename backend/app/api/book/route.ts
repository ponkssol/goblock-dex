import { NextRequest, NextResponse } from "next/server";
import { loadBook } from "@/lib/market";
import { isMint } from "@/lib/tokens";

export async function GET(request: NextRequest) {
  const mint = request.nextUrl.searchParams.get("mint") ?? "";
  if (!isMint(mint)) {
    return NextResponse.json({ msg: "That mint is not valid." }, { status: 400 });
  }
  const book = await loadBook(mint);
  return NextResponse.json({ mint, ...book });
}
