import { NextResponse } from "next/server";
import { requireSession, sqlErrorResponse } from "@/lib/api";
import { loadSchema } from "@/lib/db";
import type { SchemaTable } from "@/lib/types";

export const runtime = "nodejs";

// Table list for the sidebar and editor autocomplete. The data never changes, so it's cached per instance.
let cached: Promise<SchemaTable[]> | null = null;

export async function GET() {
  const denied = await requireSession();
  if (denied) return denied;
  try {
    if (!cached) {
      cached = loadSchema();
      cached.catch(() => (cached = null));
    }
    return NextResponse.json({ ok: true, tables: await cached });
  } catch (e) {
    return sqlErrorResponse(e);
  }
}
