import 'server-only';
import { z } from 'zod';
import { db } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/crypto';
import { ServiceError, fail, issue } from '../life/core';

export const passwordSchema = z.string().min(10, 'La nueva contraseña debe tener al menos 10 caracteres').max(200, 'La contraseña es demasiado larga');

const COMMON = new Set(['1234567890', 'contraseña1', 'password123', 'qwertyuiop', '0123456789', 'abcdefghij', 'passw0rd123', 'demo-password-123']);

/** Cambia la contraseña (exige la actual) y cierra TODAS las demás sesiones: un atacante con una sesión robada pierde el acceso. */
export async function changePassword(userId: string, currentTokenHash: string, input: { current: string; next: string }) {
  const p = passwordSchema.safeParse(input.next);
  if (!p.success) return fail(issue(p.error));
  const u = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { passwordHash: true, email: true } });
  if (!(await verifyPassword(input.current ?? '', u.passwordHash))) return fail('La contraseña actual no es correcta');
  if (input.next === input.current) return fail('La nueva contraseña debe ser distinta de la actual');
  if (input.next.toLowerCase().includes(u.email.split('@')[0]!.toLowerCase()) && u.email.split('@')[0]!.length >= 4) return fail('La contraseña no debe contener tu email');
  if (COMMON.has(input.next.toLowerCase())) return fail('Esa contraseña es demasiado común');
  const hash = await hashPassword(input.next);
  const [, revoked] = await db.$transaction([db.user.update({ where: { id: userId }, data: { passwordHash: hash } }), db.session.deleteMany({ where: { userId, tokenHash: { not: currentTokenHash } } })]);
  return { revoked: revoked.count };
}

const uaLabel = (ua: string | null) => {
  if (!ua) return 'Dispositivo desconocido';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Navegador';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${browser} en ${os}` : browser;
};

export async function listSessions(userId: string, currentTokenHash: string) {
  const rows = await db.session.findMany({ where: { userId, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' }, take: 50 });
  return rows.map((s) => ({ id: s.id, device: uaLabel(s.userAgent), ip: s.ip, createdAt: s.createdAt.toISOString(), expiresAt: s.expiresAt.toISOString(), current: s.tokenHash === currentTokenHash }));
}

/** Cierra una sesión concreta (no la actual: para eso está «Cerrar sesión»). */
export async function revokeSession(userId: string, id: string, currentTokenHash: string) {
  const r = await db.session.deleteMany({ where: { id, userId, tokenHash: { not: currentTokenHash } } });
  if (r.count === 0) throw new ServiceError('Sesión no encontrada');
}

export async function revokeOtherSessions(userId: string, currentTokenHash: string) {
  return (await db.session.deleteMany({ where: { userId, tokenHash: { not: currentTokenHash } } })).count;
}
