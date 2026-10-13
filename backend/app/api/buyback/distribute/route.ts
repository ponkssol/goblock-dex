import { PublicKey } from "@solana/web3.js";
import { NextRequest, NextResponse } from "next/server";
import { distributeTransaction } from "@/lib/buyback";
import { isMint } from "@/lib/tokens";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const payer = request.nextUrl.searchParams.get("payer") ?? "";
  if (!isMint(payer)) {
    return NextResponse.json({ msg: "Connect a wallet first." }, { status: 400 });
  }
  try {
    return NextResponse.json(await distributeTransaction(new PublicKey(payer)), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "The distribution could not be built.";
    return NextResponse.json({ msg }, { status: 409 });
  }
}
