import { NextRequest, NextResponse } from "next/server";
import type { KeyPlan } from "@/lib/access";
import { quoteBest } from "@/lib/best";
import {
  brandLinkFee,
  freeKeyFee,
  platformFee,
} from "@/lib/fees";
import { ensureOperator, operator } from "@/lib/operator";
import type { SwapFee } from "@/lib/quote";
import { isMint } from "@/lib/tokens";
import { withPriorityChoice } from "@/lib/trade";

type FeeAsk = { brandWallet?: string; platformBps?: number; feeWallet?: string };

function chooseFee(plan: KeyPlan | null, inputMint: string, outputMint: string, ask: FeeAsk): SwapFee | undefined {
  const base = plan === "free" ? freeKeyFee(inputMint, outputMint) : undefined;
  if (ask.platformBps && ask.feeWallet) return platformFee(ask.platformBps, ask.feeWallet, base);
  if (ask.brandWallet) return brandLinkFee(ask.brandWallet);
  return base;
}

function feeAsk(request: NextRequest, plan: KeyPlan | null): FeeAsk | string {
  const params = request.nextUrl.searchParams;
  const brandWallet = params.get("brandWallet") ?? undefined;
  const platformText = params.get("platformFeeBps");
  const feeWallet = params.get("feeWallet") ?? undefined;
  if (brandWallet && !isMint(brandWallet)) return "Invalid brand wallet.";
  if (!platformText && !feeWallet) {
    if (brandWallet && plan === "free") return "A free key shares fees through platformFeeBps and feeWallet.";
    return { brandWallet };
  }
  if (!plan) return "platformFeeBps needs an API key.";
  const platformBps = Number(platformText);
  const { platformMinBps, platformMaxBps } = operator();
  if (!Number.isInteger(platformBps) || platformBps < platformMinBps || platformBps > platformMaxBps) {
    return `platformFeeBps must be a whole number from ${platformMinBps} to ${platformMaxBps}.`;
  }
  if (!feeWallet || !isMint(feeWallet)) return "platformFeeBps needs a valid feeWallet.";
  if (brandWallet) return "Send brandWallet or feeWallet, not both.";
  return { platformBps, feeWallet };
}


function priorityChoice(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("priorityMode");
  const lamports = Number(request.nextUrl.searchParams.get("priorityLamports") ?? "");
  if (mode !== "max" && mode !== "exact") return null;
  if (!Number.isInteger(lamports) || lamports < 1 || lamports > 10_000_000) return null;
  return { mode, lamports } as const;
}

function cleanBrand(value: string | null): string | undefined {
  const brand = value?.trim().replace(/\s+/g, " ") ?? "";
  if (!brand) return undefined;
  if (brand.length > 32) throw new Error("Brand name must be 32 characters or fewer.");
  if (!/^[\p{L}\p{N} ._-]+$/u.test(brand)) {
    throw new Error("Brand name may use letters, numbers, spaces, periods, or dashes.");
  }
  return brand;
}

export async function respondSwap(request: NextRequest, plan: KeyPlan | null = null) {
  await ensureOperator();
  const inputMint = request.nextUrl.searchParams.get("inputMint") ?? "";
  const outputMint = request.nextUrl.searchParams.get("outputMint") ?? "";
  const amount = request.nextUrl.searchParams.get("amount") ?? "";
  const userPublicKey = request.nextUrl.searchParams.get("userPublicKey") ?? undefined;
  const slippageBps = Number(request.nextUrl.searchParams.get("slippageBps") ?? "100");
  const brandValue = request.nextUrl.searchParams.get("brand");

  if (!isMint(inputMint) || !isMint(outputMint)) {
    return NextResponse.json({ msg: "Invalid mint." }, { status: 400 });
  }
  if (!/^[1-9]\d*$/.test(amount)) {
    return NextResponse.json({ msg: "Invalid amount." }, { status: 400 });
  }
  if (!Number.isInteger(slippageBps) || slippageBps < 1 || slippageBps > 5000) {
    return NextResponse.json({ msg: "Slippage is out of range." }, { status: 400 });
  }
  if (userPublicKey && !isMint(userPublicKey)) {
    return NextResponse.json({ msg: "Invalid wallet." }, { status: 400 });
  }
  const ask = feeAsk(request, plan);
  if (typeof ask === "string") return NextResponse.json({ msg: ask }, { status: 400 });

  try {
    const brand = cleanBrand(brandValue);
    const quote = await withPriorityChoice(priorityChoice(request), () =>
      quoteBest({
        inputMint,
        outputMint,
        amount,
        slippageBps,
        userPublicKey,
        brand,
        fee: chooseFee(plan, inputMint, outputMint, ask),
      }),
    );
    return NextResponse.json(quote);
  } catch (caught) {
    const msg = caught instanceof Error ? caught.message : "Could not build the swap.";
    const status = msg.includes("No pool") || msg.includes("not found") || msg.includes("Pool account") ? 404 : 400;
    const text = msg.includes("Pool account not found") ? "No pool was found for this pair." : msg;
    return NextResponse.json({ msg: text }, { status });
  }
}
