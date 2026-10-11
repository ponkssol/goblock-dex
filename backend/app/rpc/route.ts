import { NextRequest, NextResponse } from "next/server";
import { pacedFetch } from "@/lib/rpc";

const RPC = process.env.SOLANA_RPC_URL ?? "https://solana-rpc.publicnode.com";

async function forward(request: NextRequest) {
  const body = request.method === "GET" ? undefined : await request.arrayBuffer();
  const response = await pacedFetch(RPC, {
    method: request.method,
    headers: { "content-type": request.headers.get("content-type") ?? "application/json" },
    body,
  });
  return new NextResponse(await response.arrayBuffer(), {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
  });
}

export function GET(request: NextRequest) {
  return forward(request);
}

export function POST(request: NextRequest) {
  return forward(request);
}
