import { NextRequest, NextResponse } from "next/server";
import { CheckoutError, quotePlan, settleCheckout } from "@/lib/checkout";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const fresh = { headers: { "Cache-Control": "no-store" } };

function fail(error: unknown) {
  if (error instanceof CheckoutError) return NextResponse.json({ msg: error.message }, { status: error.status, ...fresh });
  const msg = error instanceof Error ? error.message : "Checkout failed.";
  const status = /revoke one first|not enabled/i.test(msg) ? 409 : 503;
  if (status === 503) console.error("checkout failed", error);
  return NextResponse.json({ msg }, { status, ...fresh });
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    return NextResponse.json(await quotePlan(params.get("plan") ?? "", params.get("code") ?? ""), fresh);
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  const wallet = requireSession(request);
  if (wallet instanceof NextResponse) return wallet;
  try {
    const body = (await request.json().catch(() => ({}))) as { quote?: unknown; signature?: unknown };
    return NextResponse.json(await settleCheckout(wallet, body.quote, body.signature), { status: 201, ...fresh });
  } catch (error) {
    return fail(error);
  }
}
