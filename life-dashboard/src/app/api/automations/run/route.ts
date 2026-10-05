import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { db } from '@/lib/db';
import { runAutomations } from '@/server/automations/engine';
import { syncDue } from '@/server/integrations/service';
import { tzOffsetMinutes } from '@/server/settings/profile';

const digest = (s: string) => createHash('sha256').update(s).digest();

/**
 * Punto de entrada para un planificador externo (cron del sistema, GitHub Actions, Vercel Cron…):
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://tu-app/api/automations/run
 * Además de evaluar las automatizaciones, sincroniza los calendarios y feeds conectados. Sin CRON_SECRET configurado (≥ 24 caracteres) la ruta no existe. Solo devuelve recuentos, nunca datos de usuarios.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 24) return new NextResponse(null, { status: 404 });
  const given = /^Bearer (.+)$/.exec(req.headers.get('authorization') ?? '')?.[1] ?? '';
  if (!timingSafeEqual(digest(given), digest(secret))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!rateLimit('cron:automations', 6, 60_000).ok) return NextResponse.json({ error: 'Demasiadas llamadas' }, { status: 429 });
  // Primero se refrescan calendarios y feeds conectados (los más antiguos), luego se evalúan las automatizaciones con la zona horaria de cada usuario.
  const sync = await syncDue().catch((e) => { console.error('[cron] sincronización', e); return { ok: 0, failed: 0 }; });
  const users = await db.automation.findMany({ where: { enabled: true }, distinct: ['userId'], select: { userId: true, user: { select: { timezone: true } } }, take: 500 });
  let fired = 0, proposals = 0, errors = 0;
  for (const { userId, user } of users) {
    try {
      const now = new Date();
      for (const r of await runAutomations({ userId, now, tzOffset: tzOffsetMinutes(user.timezone, now) })) { fired += r.fired; proposals += r.proposals; errors += r.errors.length; }
    } catch (e) { errors++; console.error('[cron] usuario', userId, e); }
  }
  return NextResponse.json({ users: users.length, fired, proposals, errors, synced: sync.ok, syncFailed: sync.failed });
}
