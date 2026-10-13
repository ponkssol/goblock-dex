import { NextRequest, NextResponse } from "next/server";
import { DEPLOYER_WALLET } from "@/lib/admin";
import { requireSession } from "@/lib/session";
import { createVoucher, disableVoucher, listVouchers, VoucherError } from "@/lib/vouchers";

export const dynamic = "force-dynamic";

const fresh = { headers: { "Cache-Control": "no-store" } };

function deployer(wallet: string) {
  return wallet === DEPLOYER_WALLET;
}

function fail(error: unknown) {
  if (error instanceof VoucherError) return NextResponse.json({ msg: error.message }, { status: 400, ...fresh });
  console.error("voucher failed", error);
  return NextResponse.json({ msg: "The discount code could not be saved." }, { status: 503, ...fresh });
}

export async function GET(request: NextRequest) {
  const wallet = requireSession(request);
  if (wallet instanceof NextResponse) return wallet;
  if (!deployer(wallet)) return NextResponse.json({ msg: "Only the program deployer can manage discount codes." }, { status: 403, ...fresh });
  try {
    return NextResponse.json({ vouchers: await listVouchers() }, fresh);
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  const wallet = requireSession(request);
  if (wallet instanceof NextResponse) return wallet;
  if (!deployer(wallet)) return NextResponse.json({ msg: "Only the program deployer can manage discount codes." }, { status: 403, ...fresh });
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return NextResponse.json(await createVoucher(body), { status: 201, ...fresh });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: NextRequest) {
  const wallet = requireSession(request);
  if (wallet instanceof NextResponse) return wallet;
  if (!deployer(wallet)) return NextResponse.json({ msg: "Only the program deployer can manage discount codes." }, { status: 403, ...fresh });
  try {
    await disableVoucher(request.nextUrl.searchParams.get("code") ?? "");
    return NextResponse.json({ ok: true }, fresh);
  } catch (error) {
    return fail(error);
  }
}
