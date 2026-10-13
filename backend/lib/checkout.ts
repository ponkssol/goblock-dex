import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { PublicKey, SystemProgram, type VersionedTransactionResponse } from "@solana/web3.js";
import { keySecret } from "./access";
import { sql } from "./db";
import { checkoutWallet } from "./fees";
import { createKey } from "./keys";
import { ensureOperator, operator } from "./operator";
import { CHECKOUT_DAYS, CHECKOUT_PLANS, isCheckoutPlan, type CheckoutPlanId } from "./plans";
import { connection } from "./rpc";
import { SOL_MINT, USDC } from "./tokens";
import { loadUsdPrice } from "./market";
import { claimVoucher, dueUsd, lookupVoucher, releaseVoucher, VoucherError, voucherLabel } from "./vouchers";

const QUOTE_MS = 120_000;
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const ASSOCIATED_TOKEN_PROGRAM = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
const MEMO_PROGRAMS = new Set([
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
  "Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo",
]);

export class CheckoutError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

type QuoteBody = {
  id: string;
  plan: CheckoutPlanId;
  asset: "SOL" | "USDC";
  atomic: string;
  treasury: string;
  code: string;
  exp: number;
};

type Compiled = {
  programIdIndex: number;
  accountKeyIndexes?: number[];
  accounts?: number[];
  data: Uint8Array;
};

export type AssetQuote = {
  id: string;
  mint: string;
  atomic: string;
  decimals: number;
  quote: string;
};

function seal(body: QuoteBody): string {
  const secret = keySecret();
  if (!secret) throw new CheckoutError("Checkout is not enabled on this server.", 503);
  const encoded = Buffer.from(JSON.stringify(body)).toString("base64url");
  const mac = createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${mac}`;
}

export function openQuote(token: unknown): QuoteBody {
  const secret = keySecret();
  if (!secret) throw new CheckoutError("Checkout is not enabled on this server.", 503);
  if (typeof token !== "string") throw new CheckoutError("This price is not valid. Refresh and try again.");
  const dot = token.lastIndexOf(".");
  if (dot <= 0) throw new CheckoutError("This price is not valid. Refresh and try again.");
  const encoded = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(encoded).digest("base64url");
  const left = Buffer.from(mac);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    throw new CheckoutError("This price is not valid. Refresh and try again.");
  }
  let parsed: QuoteBody;
  try {
    parsed = JSON.parse(Buffer.from(encoded, "base64url").toString()) as QuoteBody;
  } catch {
    throw new CheckoutError("This price is not valid. Refresh and try again.");
  }
  if (!/^[0-9a-f]{32}$/.test(parsed.id) || !isCheckoutPlan(parsed.plan)) {
    throw new CheckoutError("This price is not valid. Refresh and try again.");
  }
  if ((parsed.asset !== "SOL" && parsed.asset !== "USDC") || !/^\d{1,18}$/.test(parsed.atomic)) {
    throw new CheckoutError("This price is not valid. Refresh and try again.");
  }
  if (typeof parsed.code !== "string") parsed.code = "";
  if (parsed.treasury !== checkoutWallet().toBase58() || parsed.exp <= Date.now()) {
    throw new CheckoutError("This price expired. Refresh and pay again.");
  }
  return parsed;
}

function asset(
  plan: CheckoutPlanId,
  assetName: "SOL" | "USDC",
  atomic: string,
  decimals: number,
  mint: string,
  code: string,
): AssetQuote {
  const id = randomBytes(16).toString("hex");
  const treasury = checkoutWallet().toBase58();
  return {
    id,
    mint,
    atomic,
    decimals,
    quote: seal({ id, plan, asset: assetName, atomic, treasury, code, exp: Date.now() + QUOTE_MS }),
  };
}

export async function quotePlan(plan: string, rawCode = "") {
  if (!isCheckoutPlan(plan)) throw new CheckoutError("Choose Builder or Starter.");
  if (!keySecret()) throw new CheckoutError("Checkout is not enabled on this server.", 503);
  await ensureOperator();
  const spec = CHECKOUT_PLANS[plan];
  const live = operator();
  const listUsd = plan === "builder" ? live.builderUsd : live.starterUsd;
  const rpm = plan === "builder" ? live.builderRpm : live.starterRpm;
  const treasury = checkoutWallet().toBase58();
  let usd = listUsd;
  let voucher: { code: string; label: string; percent: number | null; usdOff: number | null } | null = null;
  let voucherError = "";
  if (rawCode.trim()) {
    const found = await lookupVoucher(rawCode, plan);
    if (found.error || !found.voucher) voucherError = found.error || "That code is not valid.";
    else {
      usd = dueUsd(listUsd, found.voucher);
      voucher = {
        code: found.voucher.code,
        label: voucherLabel(found.voucher),
        percent: found.voucher.percent,
        usdOff: found.voucher.usdOff,
      };
    }
  }
  const code = voucher?.code ?? "";
  const usdcAtomic = String(Math.round(usd * 1_000_000));
  const usdc = asset(plan, "USDC", usdcAtomic, USDC.decimals, USDC.mint, code);
  let sol: AssetQuote | null = null;
  if (usd === 0) sol = asset(plan, "SOL", "0", 9, SOL_MINT, code);
  else {
    const price = await loadUsdPrice(SOL_MINT);
    if (price && price > 0) {
      const lamports = Math.ceil((usd / price) * 1e9);
      if (Number.isSafeInteger(lamports) && lamports > 0) sol = asset(plan, "SOL", String(lamports), 9, SOL_MINT, code);
    }
  }
  return {
    plan,
    name: spec.name,
    usd,
    listUsd,
    rpm,
    days: CHECKOUT_DAYS,
    treasury,
    voucher,
    voucherError,
    assets: { SOL: sol, USDC: usdc },
  };
}

function associatedToken(owner: PublicKey, mint: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), new PublicKey(TOKEN_PROGRAM).toBuffer(), mint.toBuffer()],
    new PublicKey(ASSOCIATED_TOKEN_PROGRAM),
  )[0];
}

function readU32(data: Uint8Array, offset: number) {
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(offset, true);
}

function readU64(data: Uint8Array, offset: number) {
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getBigUint64(offset, true);
}

function paidAmount(tx: VersionedTransactionResponse, quote: QuoteBody, wallet: string): boolean {
  if (tx.meta?.err) return false;
  const message = tx.transaction.message as {
    getAccountKeys(args?: { accountKeysFromLookups?: { writable: PublicKey[]; readonly: PublicKey[] } }): {
      get(index: number): PublicKey | undefined;
    };
    compiledInstructions?: Compiled[];
    instructions?: Compiled[];
    staticAccountKeys?: PublicKey[];
  };
  const loaded = tx.meta?.loadedAddresses;
  const keys = message.getAccountKeys(loaded ? { accountKeysFromLookups: loaded } : undefined);
  const at = (index: number) => keys.get(index)?.toBase58() ?? "";
  if (at(0) !== wallet) return false;
  const want = BigInt(quote.atomic);
  const treasury = quote.treasury;
  const usdcDest = associatedToken(new PublicKey(treasury), new PublicKey(USDC.mint)).toBase58();
  let paid = 0n;
  let memo = false;
  const instructions = message.compiledInstructions ?? message.instructions ?? [];
  for (const ix of instructions) {
    const program = at(ix.programIdIndex);
    const accounts = (ix.accountKeyIndexes ?? ix.accounts ?? []).map(at);
    const data = ix.data;
    if (MEMO_PROGRAMS.has(program) && new TextDecoder().decode(data) === `goblock:${quote.id}`) memo = true;
    if (quote.asset === "SOL" && program === SystemProgram.programId.toBase58() && data.length >= 12 && readU32(data, 0) === 2) {
      if (accounts[0] === wallet && accounts[1] === treasury) paid += readU64(data, 4);
    }
    if (quote.asset === "USDC" && program === TOKEN_PROGRAM && data.length >= 9 && data[0] === 3) {
      if (accounts[0] && accounts[1] === usdcDest && accounts[2] === wallet) paid += readU64(data, 1);
    }
    if (quote.asset === "USDC" && program === TOKEN_PROGRAM && data.length >= 10 && data[0] === 12) {
      if (accounts[1] === USDC.mint && accounts[2] === usdcDest && accounts[3] === wallet) paid += readU64(data, 1);
    }
  }
  return memo && paid >= want;
}

async function loadPayment(signature: string) {
  if (!/^[1-9A-HJ-NP-Za-km-z]{64,100}$/.test(signature)) {
    throw new CheckoutError("The payment signature is not valid.");
  }
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const tx = await connection.getTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    if (tx) {
      if (tx.meta?.err) throw new CheckoutError("The payment transaction failed.");
      if (tx.blockTime && Date.now() / 1000 - tx.blockTime > 15 * 60) {
        throw new CheckoutError("This payment is too old. Send a new one.");
      }
      return tx;
    }
    await new Promise((resolve) => setTimeout(resolve, 800));
  }
  throw new CheckoutError("The payment is not confirmed yet. Wait a moment and try again.", 409);
}

export async function settleCheckout(wallet: string, quoteToken: unknown, signature: unknown) {
  const quote = openQuote(quoteToken);
  if (typeof signature !== "string") throw new CheckoutError("The payment signature is missing.");
  const tx = await loadPayment(signature);
  if (!paidAmount(tx, quote, wallet)) {
    throw new CheckoutError("The transaction does not pay this plan to the goblock wallet.");
  }
  const claimed = await sql<{ signature: string }>(
    `insert into checkouts (signature, wallet, plan, asset, amount, key_id)
     values ($1, $2, $3, $4, $5, '')
     on conflict (signature) do nothing
     returning signature`,
    [signature, wallet, quote.plan, quote.asset, quote.atomic],
  );
  if (!claimed.length) throw new CheckoutError("This payment was already used.", 409);
  if (quote.code) {
    try {
      await claimVoucher(quote.code, quote.plan);
    } catch (error) {
      await sql("delete from checkouts where signature = $1 and key_id = ''", [signature]);
      if (error instanceof VoucherError) throw new CheckoutError(error.message);
      throw error;
    }
  }
  try {
    const spec = CHECKOUT_PLANS[quote.plan];
    const created = await createKey(wallet, spec.name, quote.plan, new Date(Date.now() + CHECKOUT_DAYS * 86_400_000));
    await sql("update checkouts set key_id = $2 where signature = $1", [signature, created.id]);
    return created;
  } catch (error) {
    await sql("delete from checkouts where signature = $1 and key_id = ''", [signature]);
    if (quote.code) await releaseVoucher(quote.code);
    throw error;
  }
}
