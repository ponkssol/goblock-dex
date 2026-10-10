import { NextRequest, NextResponse } from "next/server";
import { quoteBest } from "@/lib/best";
import { isMint } from "@/lib/tokens";

function cleanBrand(value: string | null): string | undefined {
  const brand = value?.trim().replace(/\s+/g, " ") ?? "";
  if (!brand) return undefined;
  if (brand.length > 32) throw new Error("Brand name must be 32 characters or fewer.");
  if (!/^[\p{L}\p{N} ._-]+$/u.test(brand)) {
    throw new Error("Brand name may use letters, numbers, spaces, periods, or dashes.");
  }
  return brand;
}

export async function respondSwap(request: NextRequest) {
  const inputMint = request.nextUrl.searchParams.get("inputMint") ?? "";
  const outputMint = request.nextUrl.searchParams.get("outputMint") ?? "";
  const amount = request.nextUrl.searchParams.get("amount") ?? "";
  const userPublicKey = request.nextUrl.searchParams.get("userPublicKey") ?? undefined;
  const slippageBps = Number(request.nextUrl.searchParams.get("slippageBps") ?? "100");
  const brandValue = request.nextUrl.searchParams.get("brand");
  const brandWalletValue = request.nextUrl.searchParams.get("brandWallet");

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
  if (brandWalletValue && !isMint(brandWalletValue)) {
    return NextResponse.json({ msg: "Invalid brand wallet." }, { status: 400 });
  }

  try {
    const brand = cleanBrand(brandValue);
    const quote = await quoteBest({
      inputMint,
      outputMint,
      amount,
      slippageBps,
      userPublicKey,
      brand,
      brandWallet: brandWalletValue ?? undefined,
    });
    return NextResponse.json(quote);
  } catch (caught) {
    const msg = caught instanceof Error ? caught.message : "Could not build the swap.";
    const status = msg.includes("No pool") || msg.includes("not found") || msg.includes("Pool account") ? 404 : 400;
    const text = msg.includes("Pool account not found") ? "No pool was found for this pair." : msg;
    return NextResponse.json({ msg: text }, { status });
  }
}
