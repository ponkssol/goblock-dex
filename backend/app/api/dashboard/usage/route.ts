import { NextRequest, NextResponse } from "next/server";
import { usage } from "@/lib/keys";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const wallet = requireSession(request);
  if (wallet instanceof NextResponse) return wallet;
  const key = request.nextUrl.searchParams.get("key") ?? undefined;
  if (key && !/^[0-9a-f]{24}$/.test(key)) return NextResponse.json({ msg: "Invalid key." }, { status: 400 });
  try {
    return NextResponse.json({ usage: await usage(wallet, key) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("usage read failed", error);
    return NextResponse.json({ msg: "Usage could not be loaded." }, { status: 503 });
  }
}
