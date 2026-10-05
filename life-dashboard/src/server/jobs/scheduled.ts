import 'server-only';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { runAutomations } from '../automations/engine';
import { refreshPrices, type TextFetcher } from '../finance/quotes';
import { syncDue } from '../integrations/service';
import { tzOffsetMinutes } from '../settings/profile';
import { backupRoot, writeBackup } from './backup';

export interface TickReport { users: number; fired: number; proposals: number; errors: number; synced: number; syncFailed: number; prices: number; backups: number }

/** Reserva una tarea (clave única). false si ya se hizo. */
async function claim(key: string) {
  try { await db.jobRun.create({ data: { key } }); return true; } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return false;
    throw e;
  }
}
const release = (key: string) => db.jobRun.delete({ where: { key } }).catch(() => undefined);

const localDay = (tz: string, now: Date) => new Date(now.getTime() - tzOffsetMinutes(tz, now) * 60_000).toISOString().slice(0, 10);

/**
 * Una pasada del planificador: sincroniza calendarios/feeds, evalúa automatizaciones y, una vez al día por usuario
 * (según su zona horaria), actualiza los precios de inversiones y guarda una copia de seguridad.
 * La usan el planificador interno (instrumentation.ts) y la ruta /api/automations/run.
 */
export async function runScheduledTick(now = new Date(), deps: { fetcher?: TextFetcher } = {}): Promise<TickReport> {
  const r: TickReport = { users: 0, fired: 0, proposals: 0, errors: 0, synced: 0, syncFailed: 0, prices: 0, backups: 0 };
  const sync = await syncDue(now).catch((e) => { console.error('[planificador] sincronización', e); return { ok: 0, failed: 0 }; });
  r.synced = sync.ok; r.syncFailed = sync.failed;

  const withAutomations = await db.automation.findMany({ where: { enabled: true }, distinct: ['userId'], select: { userId: true, user: { select: { timezone: true } } }, take: 500 });
  r.users = withAutomations.length;
  for (const { userId, user } of withAutomations) {
    try {
      for (const x of await runAutomations({ userId, now, tzOffset: tzOffsetMinutes(user.timezone, now) })) { r.fired += x.fired; r.proposals += x.proposals; r.errors += x.errors.length; }
    } catch (e) { r.errors++; console.error('[planificador] automatizaciones', userId, e); }
  }

  const root = backupRoot();
  const users = await db.user.findMany({ select: { id: true, email: true, timezone: true, _count: { select: { portfolios: true } } }, take: 500 });
  for (const u of users) {
    const day = localDay(u.timezone, now);
    if (u._count.portfolios > 0) {
      const key = `prices:${u.id}:${day}`;
      if (await claim(key)) {
        try {
          const res = await refreshPrices(u.id, deps.fetcher);
          // Si no se pudo consultar el mercado (sin conexión, límite de Yahoo…), se reintenta en la próxima pasada.
          const offline = res.updated.length === 0 && res.failed.some((f) => f.reason.startsWith('No se pudo consultar'));
          if (offline) await release(key); else if (res.updated.length) r.prices++;
        } catch (e) { r.errors++; await release(key); console.error('[planificador] precios', u.id, e); }
      }
    }
    if (root) {
      const key = `backup:${u.id}:${day}`;
      if (await claim(key)) {
        try { await writeBackup(u, root, day); r.backups++; } catch (e) { r.errors++; await release(key); console.error('[planificador] copia', u.id, e); }
      }
    }
  }
  await db.jobRun.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 40 * 86_400_000) } } });
  return r;
}
