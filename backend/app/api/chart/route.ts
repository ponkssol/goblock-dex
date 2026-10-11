import { NextRequest, NextResponse } from "next/server";
import { loadSide } from "@/lib/market";
import { isMint } from "@/lib/tokens";

export async function GET(request: NextRequest) {
  const pay = request.nextUrl.searchParams.get("pay") ?? "";
  const receive = request.nextUrl.searchParams.get("receive") ?? "";
  const range = request.nextUrl.searchParams.get("range") ?? "1D";
  if (!isMint(pay) || !isMint(receive)) {
    return NextResponse.json({ msg: "That mint is not valid." }, { status: 400 });
  }

  const [paySide, receiveSide] = await Promise.all([loadSide(pay, range), loadSide(receive, range)]);
  const msg = paySide.msg ?? receiveSide.msg;
  return NextResponse.json({ pay: paySide, receive: receiveSide, ...(msg ? { msg } : {}) });
}
