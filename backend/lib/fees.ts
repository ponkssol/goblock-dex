import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

export const BRAND_FEE_BPS = 5;
const TREASURY = "CwVD4jd6BeLAWZeEqMFerD8bLoQevSy5rmwawFTa3nuo";

export function treasuryAddress(): PublicKey {
  return new PublicKey(process.env.GOBLOCK_TREASURY ?? TREASURY);
}

export function brandFee(amount: BN, enabled: boolean): BN {
  if (!enabled || amount.isNeg() || amount.isZero()) return new BN(0);
  return amount.muln(BRAND_FEE_BPS).divn(10_000);
}

export function feeShares(brandWallet: PublicKey, fee: BN): {
  treasury: PublicKey;
  treasuryLamports: BN;
  brandLamports: BN;
} {
  const treasury = treasuryAddress();
  if (fee.isZero() || brandWallet.equals(treasury)) {
    return { treasury, treasuryLamports: fee, brandLamports: new BN(0) };
  }
  const brandLamports = fee.divn(2);
  return { treasury, treasuryLamports: fee.sub(brandLamports), brandLamports };
}
