import { NextRequest, NextResponse } from "next/server";
import { requireDeployer } from "@/lib/admin";
import { listWaitlist, removeWaitlist, WaitlistError } from "@/lib/waitlist";

export const dynamic = "force-dynamic";

const fresh = { headers: { "Cache-Control": "no-store" } };

export async function GET(request: NextRequest) {
  const wallet = requireDeployer(request);
  if (wallet instanceof NextResponse) return wallet;
  try {
    return NextResponse.json({ entries: await listWaitlist() }, fresh);
  } catch (error) {
    console.error("admin waitlist failed", error);
    return NextResponse.json({ msg: "The waitlist could not be loaded." }, { status: 503, ...fresh });
  }
}

export async function DELETE(request: NextRequest) {
  const wallet = requireDeployer(request);
  if (wallet instanceof NextResponse) return wallet;
  try {
    await removeWaitlist(request.nextUrl.searchParams.get("id") ?? "");
    return NextResponse.json({ ok: true }, fresh);
  } catch (error) {
    if (error instanceof WaitlistError) return NextResponse.json({ msg: error.message }, { status: 400, ...fresh });
    console.error("admin waitlist remove failed", error);
    return NextResponse.json({ msg: "That entry could not be removed." }, { status: 503, ...fresh });
  }
}
