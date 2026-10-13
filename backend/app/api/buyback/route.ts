import { NextResponse } from "next/server";
import { buybackState } from "@/lib/buyback";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await buybackState(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ msg: "The vault could not be read. Try again." }, { status: 502 });
  }
}
