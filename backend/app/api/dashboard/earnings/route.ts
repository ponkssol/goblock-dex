import { NextRequest, NextResponse } from "next/server";
import { earnings } from "@/lib/earnings";
import { feeWallets } from "@/lib/keys";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const wallet = requireSession(request);
  if (wallet instanceof NextResponse) return wallet;
  try {
    const wallets = await earnings(await feeWallets(wallet));
    return NextResponse.json({ wallets }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("earnings read failed", error);
    return NextResponse.json({ msg: "Earnings could not be read from the chain." }, { status: 502 });
  }
}
