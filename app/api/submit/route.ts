import { NextResponse } from "next/server";
import { readJson, requireSession, sqlErrorResponse } from "@/lib/api";
import { runReadOnly } from "@/lib/db";
import { expectedResult } from "@/lib/expected";
import { grade } from "@/lib/grader";
import { SOLUTIONS } from "@/lib/solutions";

export const runtime = "nodejs";
export const maxDuration = 20;

export async function POST(req: Request) {
  const denied = await requireSession();
  if (denied) return denied;

  const body = await readJson<{ id?: unknown; sql?: unknown }>(req);
  const id = typeof body?.id === "string" ? body.id : "";
  const solution = SOLUTIONS[id];
  if (!solution || typeof body?.sql !== "string") {
    return NextResponse.json({ ok: false, error: { message: "Unknown question." } }, { status: 400 });
  }

  try {
    const [expected, result] = await Promise.all([expectedResult(id), runReadOnly(body.sql, 1000)]);
    const g = grade(expected, result, solution.orderBy);
    return NextResponse.json({
      ok: true,
      result,
      verdict: {
        ...g,
        expectedRowCount: expected.rowCount,
        ...(g.correct ? { solution: solution.sql, insight: solution.insight } : {}),
      },
    });
  } catch (e) {
    return sqlErrorResponse(e);
  }
}
