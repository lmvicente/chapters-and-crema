import { NextResponse } from "next/server";
import { readJson, requireSession } from "@/lib/api";
import { SOLUTIONS } from "@/lib/solutions";

export const runtime = "nodejs";

// "Show the answer" after all three hints. The UI only offers this once the hints are used up.
export async function POST(req: Request) {
  const denied = await requireSession();
  if (denied) return denied;

  const body = await readJson<{ id?: unknown }>(req);
  const solution = typeof body?.id === "string" ? SOLUTIONS[body.id] : undefined;
  if (!solution) return NextResponse.json({ ok: false, error: { message: "Unknown question." } }, { status: 400 });
  return NextResponse.json({ ok: true, solution: solution.sql, insight: solution.insight });
}
