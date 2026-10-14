import { PUBLIC_SKILL } from "@goblock/shared/skill";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return new NextResponse(PUBLIC_SKILL, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": 'attachment; filename="goblock-skill.md"',
      "Cache-Control": "no-store",
    },
  });
}
