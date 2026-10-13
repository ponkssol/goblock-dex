import { createHmac, createPublicKey, timingSafeEqual, verify } from "node:crypto";
import { PublicKey } from "@solana/web3.js";
import { NextRequest, NextResponse } from "next/server";
import { keySecret } from "./access";
import { isMint } from "./tokens";

const SIGN_WINDOW_MS = 5 * 60 * 1000;
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

export function signInMessage(wallet: string, issuedAt: string): string {
  return [
    "Sign in to the goblock API dashboard.",
    "",
    `Wallet: ${wallet}`,
    `Issued: ${issuedAt}`,
    "",
    "Signing does not send a transaction or cost any SOL.",
  ].join("\n");
}

function seal(secret: string, wallet: string, expires: number): string {
  return createHmac("sha256", secret).update(`session:${wallet}.${expires}`).digest("base64url");
}

function signedBy(wallet: string, message: string, signature: Buffer): boolean {
  const x = Buffer.from(new PublicKey(wallet).toBytes()).toString("base64url");
  const key = createPublicKey({ key: { kty: "OKP", crv: "Ed25519", x }, format: "jwk" });
  return signature.length === 64 && verify(null, Buffer.from(message, "utf8"), key, signature);
}

export function openSession(input: { wallet?: unknown; issuedAt?: unknown; signature?: unknown }) {
  const secret = keySecret();
  if (!secret) throw new Error("API keys are not enabled on this server.");
  const { wallet, issuedAt, signature } = input;
  if (typeof wallet !== "string" || !isMint(wallet)) throw new Error("Invalid wallet.");
  if (typeof issuedAt !== "string" || typeof signature !== "string") throw new Error("The sign-in is incomplete.");
  const age = Date.now() - Date.parse(issuedAt);
  if (!Number.isFinite(age) || age > SIGN_WINDOW_MS || age < -60_000) {
    throw new Error("The sign-in message expired. Sign again.");
  }
  if (!signedBy(wallet, signInMessage(wallet, issuedAt), Buffer.from(signature, "base64"))) {
    throw new Error("The signature does not match this wallet.");
  }
  const expires = Date.now() + SESSION_MS;
  return { token: `${wallet}.${expires}.${seal(secret, wallet, expires)}`, wallet, expiresAt: expires };
}

/** Returns the signed-in wallet, or a 401 response. */
export function requireSession(request: NextRequest): string | NextResponse {
  const denied = NextResponse.json({ msg: "Sign in with your wallet first." }, { status: 401 });
  const secret = keySecret();
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
  const [wallet, expiresText, mac] = token.split(".");
  const expires = Number(expiresText);
  if (!secret || !wallet || !mac || !isMint(wallet) || !Number.isFinite(expires) || expires < Date.now()) return denied;
  const expected = seal(secret, wallet, expires);
  if (mac.length !== expected.length || !timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return denied;
  return wallet;
}
