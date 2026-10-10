import { PublicKey, SystemProgram, type TransactionInstruction } from "@solana/web3.js";
import BN from "bn.js";
import program from "../program-id/goblock-program.json";

export const BRAND_FEE_BPS = 5;

export function treasuryAddress(): PublicKey {
  return new PublicKey(process.env.GOBLOCK_TREASURY ?? program.upgradeAuthority);
}

export function brandFee(amount: BN, enabled: boolean): BN {
  if (!enabled || amount.isNeg() || amount.isZero()) return new BN(0);
  return amount.muln(BRAND_FEE_BPS).divn(10_000);
}

export function feeTransfers(payer: PublicKey, brandWallet: PublicKey, fee: BN): TransactionInstruction[] {
  if (fee.isZero() || !Number.isSafeInteger(fee.toNumber())) return [];
  const treasury = treasuryAddress();
  if (brandWallet.equals(treasury)) {
    return [SystemProgram.transfer({ fromPubkey: payer, toPubkey: treasury, lamports: fee.toNumber() })];
  }

  const brandPart = fee.divn(2);
  const treasuryPart = fee.sub(brandPart);
  const transfers: TransactionInstruction[] = [];
  if (brandPart.gtn(0)) {
    transfers.push(
      SystemProgram.transfer({ fromPubkey: payer, toPubkey: brandWallet, lamports: brandPart.toNumber() }),
    );
  }
  if (treasuryPart.gtn(0)) {
    transfers.push(
      SystemProgram.transfer({ fromPubkey: payer, toPubkey: treasury, lamports: treasuryPart.toNumber() }),
    );
  }
  return transfers;
}
