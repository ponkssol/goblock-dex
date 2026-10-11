import { NextRequest } from "next/server";
import { rejectWithoutKey } from "@/lib/access";
import { respondSwap } from "@/lib/swap-http";

export async function GET(request: NextRequest) {
  const denied = rejectWithoutKey(request);
  if (denied) return denied;
  return respondSwap(request);
}
