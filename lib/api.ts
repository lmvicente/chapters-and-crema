import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ConfigError, SqlError } from "./db";
import { SESSION_COOKIE, sessionSecret, verifySessionToken } from "./session";

// Second line of defense after middleware: every API route re-checks the session itself.
export async function requireSession(): Promise<NextResponse | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (await verifySessionToken(token, sessionSecret())) return null;
  return NextResponse.json({ error: "Your session ended. Reload the page and enter the passcode." }, { status: 401 });
}

export async function readJson<T>(req: Request): Promise<T | null> {
  if (!req.headers.get("content-type")?.includes("application/json")) return null;
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

export function sqlErrorResponse(e: unknown) {
  if (e instanceof SqlError) {
    return NextResponse.json({ ok: false, error: e.toJSON() });
  }
  if (e instanceof ConfigError) {
    return NextResponse.json({ ok: false, error: { message: e.message, setup: true } }, { status: 503 });
  }
  console.error(e);
  return NextResponse.json({ ok: false, error: { message: "Something went wrong on the server. Try again." } }, { status: 500 });
}
