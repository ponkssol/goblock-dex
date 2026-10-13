import { NextRequest, NextResponse } from "next/server";
import { joinWaitlist, WaitlistError } from "@/lib/waitlist";

export const dynamic = "force-dynamic";

const fresh = { headers: { "Cache-Control": "no-store" } };
const hits = new Map<string, number[]>();

function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((at) => now - at < 3_600_000);
  if (recent.length >= 8) return true;
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (limited(ip)) {
    return NextResponse.json({ msg: "Too many signups from this network. Try again later." }, { status: 429, ...fresh });
  }
  try {
    const body = (await request.json().catch(() => ({}))) as { email?: unknown; wallet?: unknown };
    return NextResponse.json(await joinWaitlist(body.email, body.wallet), { status: 201, ...fresh });
  } catch (error) {
    if (error instanceof WaitlistError) return NextResponse.json({ msg: error.message }, { status: 400, ...fresh });
    console.error("waitlist join failed", error);
    return NextResponse.json({ msg: "The list could not be updated. Try again." }, { status: 503, ...fresh });
  }
}
