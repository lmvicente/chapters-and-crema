import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, authConfig, verifySessionToken } from '@/lib/session';

// Every page and API route requires a valid login cookie, except the login page itself.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith('/api/');
  const { secret, ok } = authConfig();

  if (!ok) {
    const msg = 'The app is not configured yet: set APP_PASSCODE and SESSION_SECRET (16+ characters).';
    return isApi
      ? NextResponse.json({ error: msg }, { status: 503 })
      : new NextResponse(msg, { status: 503, headers: { 'content-type': 'text/plain' } });
  }

  if (await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value, secret)) {
    return NextResponse.next();
  }

  if (isApi) return NextResponse.json({ error: 'Your session has ended. Sign in again.' }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!login|api/login|_next/static|_next/image|favicon.ico|icon.svg).*)'],
};
