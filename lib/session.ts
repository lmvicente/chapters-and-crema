// Signed login cookie. Uses Web Crypto only, so it works in both the
// middleware (edge runtime) and API routes (Node runtime).

export const SESSION_COOKIE = 'lab_session';
export const SESSION_DAYS = 30;

const enc = new TextEncoder();

function b64url(bytes: ArrayBuffer): string {
  let s = '';
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);
}

export function sessionSecret(): string {
  const s = process.env.SESSION_SECRET ?? '';
  return s.length >= 16 ? s : '';
}

export function authConfig() {
  const secret = process.env.SESSION_SECRET ?? '';
  const passcode = process.env.APP_PASSCODE ?? '';
  return { secret, passcode, ok: secret.length >= 16 && passcode.length > 0 };
}

export async function createSessionToken(secret: string): Promise<string> {
  const exp = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = `v1.${exp}`;
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(payload));
  return `${payload}.${b64url(sig)}`;
}

export async function verifySessionToken(token: string | undefined, secret: string): Promise<boolean> {
  if (!token || !secret) return false;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return false;
  const exp = Number(parts[1]);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  try {
    return await crypto.subtle.verify(
      'HMAC',
      await hmacKey(secret),
      fromB64url(parts[2]),
      enc.encode(`${parts[0]}.${parts[1]}`),
    );
  } catch {
    return false;
  }
}
