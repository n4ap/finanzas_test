import { NextResponse, type NextRequest } from 'next/server';

// /api/automations/run se autentica solo con CRON_SECRET (llamada de un planificador, sin cookie).
const PUBLIC = ['/login', '/register', '/api/automations/run'];

/**
 * Content-Security-Policy con nonce por petición: solo se ejecutan los scripts de la propia aplicación (Next los firma
 * con el nonce que lee de la cabecera de la petición); un HTML inyectado no podría ejecutar JavaScript.
 * Los estilos en línea (atributo style de React/Recharts) requieren 'unsafe-inline' en style-src.
 */
function csp(nonce: string) {
  const dev = process.env.NODE_ENV !== 'production';
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self'${dev ? ' ws: wss:' : ''}`,
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

/**
 * Barrera ligera: sin cookie de sesión → /login (o 401 en /api).
 * La validación real (BD) ocurre en requireUser() y en cada API; /login redirige si ya hay sesión válida.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const nonce = btoa(crypto.randomUUID());
  const policy = csp(nonce);
  const secure = req.nextUrl.protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https';
  const decorate = (res: NextResponse) => {
    res.headers.set('Content-Security-Policy', policy);
    if (secure) res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    return res;
  };

  if (!(req.cookies.has('ld_session') || PUBLIC.some((p) => pathname.startsWith(p)))) {
    if (pathname.startsWith('/api/')) return decorate(NextResponse.json({ error: 'No autenticado' }, { status: 401 }));
    return decorate(NextResponse.redirect(new URL('/login', req.url)));
  }
  const headers = new Headers(req.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', policy); // Next toma el nonce de aquí para firmar sus propios scripts
  return decorate(NextResponse.next({ request: { headers } }));
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest).*)'] };
