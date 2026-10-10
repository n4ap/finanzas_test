import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { runScheduledTick } from '@/server/jobs/scheduled';

const digest = (s: string) => createHash('sha256').update(s).digest();

/**
 * Punto de entrada para un planificador externo (cron del sistema, GitHub Actions, Vercel Cron…):
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://tu-app/api/automations/run
 * Hace lo mismo que el planificador interno: sincroniza calendarios y feeds, evalúa automatizaciones y las tareas diarias
 * (precios y copias). Sin CRON_SECRET configurado (≥ 24 caracteres) la ruta no existe. Solo devuelve recuentos, nunca datos de usuarios.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 24) return new NextResponse(null, { status: 404 });
  const given = /^Bearer (.+)$/.exec(req.headers.get('authorization') ?? '')?.[1] ?? '';
  if (!timingSafeEqual(digest(given), digest(secret))) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!rateLimit('cron:automations', 6, 60_000).ok) return NextResponse.json({ error: 'Demasiadas llamadas' }, { status: 429 });
  return NextResponse.json(await runScheduledTick());
}
