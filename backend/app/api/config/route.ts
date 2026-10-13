import { NextResponse } from "next/server";
import { checkoutWallet, freeFeeRows, treasuryAddress } from "@/lib/fees";
import { ensureOperator, operator } from "@/lib/operator";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureOperator();
  const live = operator();
  return NextResponse.json({
    treasury: treasuryAddress().toBase58(),
    checkoutWallet: checkoutWallet().toBase58(),
    brandFeeBps: live.brandBps,
    freeKeyFees: freeFeeRows(),
    plans: {
      freeRpm: live.freeRpm,
      builderUsd: live.builderUsd,
      builderRpm: live.builderRpm,
      starterUsd: live.starterUsd,
      starterRpm: live.starterRpm,
    },
    fees: {
      stableBps: live.stableBps,
      majorBps: live.majorBps,
      otherBps: live.otherBps,
      curveBps: live.curveBps,
      brandBps: live.brandBps,
      platformMinBps: live.platformMinBps,
      platformMaxBps: live.platformMaxBps,
    },
  });
}
