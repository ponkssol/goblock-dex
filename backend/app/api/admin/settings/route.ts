import { NextRequest, NextResponse } from "next/server";
import { requireDeployer } from "@/lib/admin";
import { checkoutWallet, treasuryAddress } from "@/lib/fees";
import { ensureOperator, OperatorError, operator, saveOperator } from "@/lib/operator";

export const dynamic = "force-dynamic";

const fresh = { headers: { "Cache-Control": "no-store" } };

function payload() {
  return {
    ...operator(),
    checkoutWallet: checkoutWallet().toBase58(),
    treasury: treasuryAddress().toBase58(),
  };
}

export async function GET(request: NextRequest) {
  const wallet = requireDeployer(request);
  if (wallet instanceof NextResponse) return wallet;
  try {
    await ensureOperator();
    return NextResponse.json(payload(), fresh);
  } catch (error) {
    console.error("admin settings read failed", error);
    return NextResponse.json({ msg: "Settings could not be loaded." }, { status: 503, ...fresh });
  }
}

export async function PUT(request: NextRequest) {
  const wallet = requireDeployer(request);
  if (wallet instanceof NextResponse) return wallet;
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    await saveOperator(body);
    return NextResponse.json(payload(), fresh);
  } catch (error) {
    if (error instanceof OperatorError) return NextResponse.json({ msg: error.message }, { status: 400, ...fresh });
    console.error("admin settings save failed", error);
    return NextResponse.json({ msg: "Settings could not be saved." }, { status: 503, ...fresh });
  }
}
