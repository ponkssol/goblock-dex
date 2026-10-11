import { NextRequest, NextResponse } from "next/server";
import { searchTokens } from "@/lib/token-directory";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? "";
  const raw = request.nextUrl.searchParams.get("scope");
  const scope = raw === "verified" || raw === "equities" ? raw : "pump";
  try {
    const tokens = await searchTokens(query, scope);
    return NextResponse.json({ tokens });
  } catch {
    return NextResponse.json({ tokens: [], msg: "The token list could not be loaded." }, { status: 200 });
  }
}
