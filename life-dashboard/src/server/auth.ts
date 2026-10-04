import 'server-only';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { db } from '@/lib/db';
import { randomToken, sha256, verifyPassword } from '@/lib/crypto';

export const SESSION_COOKIE = 'ld_session';
const SESSION_DAYS = 30;

export async function createSession(userId: string) {
  const token = randomToken();
  const h = await headers();
  await db.session.create({
    data: {
      userId,
      tokenHash: sha256(token),
      userAgent: h.get('user-agent')?.slice(0, 200),
      ip: h.get('x-forwarded-for')?.split(',')[0]?.trim(),
      expiresAt: new Date(Date.now() + SESSION_DAYS * 86_400_000),
    },
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(SESSION_COOKIE);
}

/** Usuario actual o null. Cacheado por petición. */
export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!session || session.expiresAt < new Date()) return null;
  const { passwordHash, ...user } = session.user;
  void passwordHash; // nunca sale del servidor
  return user;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** Garantiza usuario autenticado; redirige a /login si no. Toda consulta de datos debe filtrar por user.id. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

export async function authenticate(email: string, password: string) {
  const user = await db.user.findUnique({ where: { email } });
  // Verificación siempre ejecutada para no filtrar si el email existe por tiempo de respuesta.
  const ok = await verifyPassword(password, user?.passwordHash ?? 'aa:bb');
  return user && ok ? user : null;
}
