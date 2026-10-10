import { NextRequest, NextResponse } from "next/server";

export function rejectWithoutKey(request: NextRequest): NextResponse | null {
  const presented = request.headers.get("x-api-key")?.trim() ?? "";
  const allowed = (process.env.GOBLOCK_API_KEYS ?? "")
    .split(",")
    .map((key) => key.trim())
    .filter((key) => key.length > 0);
  if (!presented || !allowed.includes(presented)) {
    return NextResponse.json(
      { msg: "This API requires a subscription key. Send an x-api-key header." },
      { status: 401 },
    );
  }
  return null;
}
