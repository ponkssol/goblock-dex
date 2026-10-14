import { NextRequest } from "next/server";
import { mcpOptions, mcpPost } from "@/lib/mcp";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export function OPTIONS() {
  return mcpOptions();
}

export function POST(request: NextRequest) {
  return mcpPost(request);
}
