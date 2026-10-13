import { NextRequest, NextResponse } from "next/server";
import { openSession, signInMessage } from "@/lib/session";
import { isMint } from "@/lib/tokens";

export const dynamic = "force-dynamic";

const fresh = { headers: { "Cache-Control": "no-store" } };

export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get("wallet") ?? "";
  if (!isMint(wallet)) return NextResponse.json({ msg: "Invalid wallet." }, { status: 400 });
  const issuedAt = new Date().toISOString();
  return NextResponse.json({ issuedAt, message: signInMessage(wallet, issuedAt) }, fresh);
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return NextResponse.json(openSession(body), fresh);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Sign-in failed.";
    return NextResponse.json({ msg }, { status: 401 });
  }
}
