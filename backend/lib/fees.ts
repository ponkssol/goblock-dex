import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import type { SwapFee } from "./quote";
import { operator } from "./operator";
import { SOL_MINT } from "./tokens";

export const BRAND_FEE_BPS = 5;
export const CURVE_FEE_BPS = 20;
export const PLATFORM_FEE_MIN_BPS = 50;
export const PLATFORM_FEE_MAX_BPS = 255;
const PLATFORM_SHARE = 1_000;
/** The buyback vault PDA of the goblock program. Swap fees land here. */
const TREASURY = "7bo6FFvvfPfzcBn7tow8hhUrtXmYboeoqCaNmHBqqsaF";
/** Receives Builder and Starter subscription payments. Swap fees stay in the vault. */
const CHECKOUT_WALLET = "Baik5ApDziz9Hzyqq6EoUFUb9jFh5AeqmFCqfGgbXy77";

const PEGGED = new Set([
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo",
  "USDSwr9ApdHk5bvJKMjzff41FfuX8bSxdKcR81vTwcA",
  "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn",
  "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",
  "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1",
  "jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v",
  "5oVNBeEEQvYi1cX3ir8Dx5n1P7pdxydbGF2X4TxVusJm",
  "7Q2afV64in6N6SeZsAAB81TJzwDoD6zpqmHkzi9Dcavn",
]);

const MAJORS = new Set([
  "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
  "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL",
  "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3",
  "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
  "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE",
  "85VBFQZC9TZkfaptBWjvUw7YbZjy52A6mjtPGjstQAmQ",
  "rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof",
  "hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux",
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
  "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
]);

export const FREE_FEES = [
  { pair: "SOL with a stablecoin or an LST", bps: 0 },
  { pair: "SOL with a major token", bps: 3 },
  { pair: "SOL with any other pool token", bps: 5 },
  { pair: "SOL with a bonding-curve token", bps: CURVE_FEE_BPS },
  { pair: "No SOL on either side", bps: 0 },
];

export type Charge = { bps: number; share: number; wallet?: string };

const NO_CHARGE: Charge = { bps: 0, share: 10_000 };

export function treasuryAddress(): PublicKey {
  return new PublicKey(process.env.GOBLOCK_TREASURY || TREASURY);
}

export function checkoutWallet(): PublicKey {
  return new PublicKey(process.env.GOBLOCK_CHECKOUT_WALLET || CHECKOUT_WALLET);
}

export function brandLinkFee(wallet: string): SwapFee {
  const bps = operator().brandBps;
  return { bps, curveBps: bps, share: 5_000, curveShare: 5_000, wallet };
}

export function poolFeeBps(inputMint: string, outputMint: string): number {
  const live = operator();
  const other = inputMint === SOL_MINT ? outputMint : outputMint === SOL_MINT ? inputMint : null;
  if (!other) return 0;
  if (PEGGED.has(other)) return live.stableBps;
  return MAJORS.has(other) ? live.majorBps : live.otherBps;
}

export function freeKeyFee(inputMint: string, outputMint: string): SwapFee {
  return { bps: poolFeeBps(inputMint, outputMint), curveBps: operator().curveBps, share: 10_000, curveShare: 10_000 };
}

export function freeFeeRows() {
  const live = operator();
  return [
    { pair: "SOL with a stablecoin or an LST", bps: live.stableBps },
    { pair: "SOL with a major token", bps: live.majorBps },
    { pair: "SOL with any other pool token", bps: live.otherBps },
    { pair: "SOL with a bonding-curve token", bps: live.curveBps },
    { pair: "No SOL on either side", bps: 0 },
  ];
}

/** The treasury keeps 10% of a platform fee, and never less than the base fee the key would pay. */
export function platformFee(bps: number, wallet: string, base?: SwapFee): SwapFee {
  const share = (baseBps: number) => Math.min(10_000, Math.max(PLATFORM_SHARE, Math.ceil((baseBps * 10_000) / bps)));
  return {
    bps,
    curveBps: bps,
    share: share(base?.bps ?? 0),
    curveShare: share(base?.curveBps ?? 0),
    wallet,
  };
}

export function chargeFor(input: { fee?: SwapFee; assemble?: boolean }, curve = false): Charge {
  if (input.assemble === false || !input.fee) return NO_CHARGE;
  const { fee } = input;
  return curve
    ? { bps: fee.curveBps, share: fee.curveShare, wallet: fee.wallet }
    : { bps: fee.bps, share: fee.share, wallet: fee.wallet };
}

export function feeOf(amount: BN, bps: number): BN {
  if (bps <= 0 || amount.isNeg() || amount.isZero()) return new BN(0);
  return amount.muln(bps).divn(10_000);
}

export function feeShares(fee: BN, charge: Charge): {
  treasury: PublicKey;
  treasuryLamports: BN;
  wallet: PublicKey;
} {
  const treasury = treasuryAddress();
  const wallet = charge.wallet ? new PublicKey(charge.wallet) : treasury;
  if (fee.isZero() || wallet.equals(treasury)) return { treasury, treasuryLamports: fee, wallet: treasury };
  const walletLamports = fee.muln(10_000 - charge.share).divn(10_000);
  return { treasury, treasuryLamports: fee.sub(walletLamports), wallet };
}
