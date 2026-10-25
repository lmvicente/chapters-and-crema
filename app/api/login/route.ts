import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { readJson } from "@/lib/api";
import { createSessionToken, SESSION_COOKIE, SESSION_DAYS, sessionSecret } from "@/lib/session";

export const runtime = "nodejs";

// Best-effort brute-force brake: 10 wrong guesses per IP per 15 minutes, per server instance.
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60_000;
const MAX_ATTEMPTS = 10;

function digest(s: string) {
  return createHash("sha256").update(s).digest();
}

export async function POST(req: Request) {
  const passcode = process.env.APP_PASSCODE;
  const secret = sessionSecret();
  if (!passcode || !secret) {
    return NextResponse.json(
      { error: "The lab isn't set up yet. APP_PASSCODE and SESSION_SECRET (16+ characters) need to be set in the Vercel settings." },
      { status: 503 },
    );
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const entry = attempts.get(ip);
  if (entry && entry.resetAt > now && entry.count >= MAX_ATTEMPTS) {
    return NextResponse.json({ error: "Too many wrong passcodes. Wait 15 minutes and try again." }, { status: 429 });
  }

  const body = await readJson<{ passcode?: unknown }>(req);
  const given = typeof body?.passcode === "string" ? body.passcode : "";
  if (!timingSafeEqual(digest(given), digest(passcode))) {
    const e = entry && entry.resetAt > now ? entry : { count: 0, resetAt: now + WINDOW_MS };
    e.count++;
    attempts.set(ip, e);
    return NextResponse.json({ error: "That passcode isn't right." }, { status: 401 });
  }

  attempts.delete(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
  return res;
}
