import { PublicKey } from "@solana/web3.js";
import { NextRequest, NextResponse } from "next/server";
import { setMintTransaction } from "@/lib/buyback";
import { isMint } from "@/lib/tokens";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const mint = request.nextUrl.searchParams.get("mint") ?? "";
  if (!isMint(mint)) {
    return NextResponse.json({ msg: "That contract address is not valid." }, { status: 400 });
  }
  try {
    return NextResponse.json(await setMintTransaction(new PublicKey(mint)), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "The transaction could not be built.";
    return NextResponse.json({ msg }, { status: 409 });
  }
}
