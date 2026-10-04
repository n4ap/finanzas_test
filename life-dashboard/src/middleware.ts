import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC = ['/login', '/register'];

/**
 * Barrera ligera: sin cookie de sesión → /login (o 401 en /api).
 * La validación real (BD) ocurre en requireUser() y en cada API; /login redirige si ya hay sesión válida.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (req.cookies.has('ld_session') || PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  return NextResponse.redirect(new URL('/login', req.url));
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
