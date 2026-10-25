import { NextResponse } from "next/server";
import { readJson, requireSession, sqlErrorResponse } from "@/lib/api";
import { runReadOnly } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 20;

const DISPLAY_ROWS = 1000;

export async function POST(req: Request) {
  const denied = await requireSession();
  if (denied) return denied;

  const body = await readJson<{ sql?: unknown }>(req);
  if (typeof body?.sql !== "string") {
    return NextResponse.json({ ok: false, error: { message: "Send the query as JSON: { \"sql\": \"...\" }." } }, { status: 400 });
  }
  try {
    const result = await runReadOnly(body.sql, DISPLAY_ROWS);
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    return sqlErrorResponse(e);
  }
}
