import { NextRequest } from "next/server";
import { respondSwap } from "@/lib/swap-http";

export async function GET(request: NextRequest) {
  return respondSwap(request);
}
