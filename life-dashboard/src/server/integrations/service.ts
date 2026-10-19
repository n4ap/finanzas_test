import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { db } from '@/lib/db';
import { decrypt, encrypt } from '@/lib/crypto';
import { parseFeed } from '@/lib/feed';
import { parseIcs } from '@/lib/ics';
import { NEWS_CATEGORY_IDS } from '@/lib/news';
import { checkUserUrl } from '@/lib/net-guard';
import { ServiceError, fail, issue } from '../life/core';
import { safeFetchText } from './safe-fetch';

export const LIMITS = { calendars: 5, feeds: 10 } as const;
const hash = (url: string) => createHash('sha256').update(url).digest('hex').slice(0, 24);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const urlField = z.string().trim().min(8).max(2000);

export const calendarSubSchema = z.object({ name: z.string().trim().min(1, 'Ponle un nombre').max(60), url: urlField, color: color.default('#0ea5e9') });
export const feedSchema = z.object({ name: z.string().trim().max(80).optional(), url: urlField, category: z.enum(NEWS_CATEGORY_IDS) });

async function userTz(userId: string) { return (await db.user.findUnique({ where: { id: userId }, select: { timezone: true } }))?.timezone ?? 'Europe/Madrid'; }
const setStatus = (id: string, ok: boolean, error?: string) => db.account.update({ where: { id }, data: ok ? { status: 'connected', lastError: null, lastSyncAt: new Date() } : { status: 'error', lastError: (error ?? 'Error').slice(0, 300), lastSyncAt: new Date() } });

// ───────────── Calendarios (iCal por URL, solo lectura) ─────────────

export async function addCalendarSubscription(userId: string, input: unknown) {
  const p = calendarSubSchema.safeParse(input);
  if (!p.success) return fail(issue(p.error));
  const checked = checkUserUrl(p.data.url);
  if (!checked.ok) return fail(checked.error);
  if ((await db.account.count({ where: { userId, provider: 'ics', kind: 'calendar' } })) >= LIMITS.calendars) return fail(`Máximo ${LIMITS.calendars} calendarios suscritos`);
  const url = checked.url.toString();
  const externalId = hash(url);
  if (await db.account.findFirst({ where: { userId, provider: 'ics', kind: 'calendar', externalId } })) return fail('Ya estás suscrito a ese calendario');
  const { text } = await safeFetchText(url, { accept: 'text/calendar, text/plain, */*' });
  if (!/BEGIN:VCALENDAR/i.test(text)) return fail('La dirección no devuelve un calendario iCal (.ics)');
  const acc = await db.account.create({ data: { userId, provider: 'ics', kind: 'calendar', externalId, label: p.data.name, accessTokenEnc: encrypt(url), status: 'connected' } });
  const cal = await db.calendar.create({ data: { userId, accountId: acc.id, externalId, name: p.data.name, color: p.data.color } });
  const n = await importIcs(userId, cal.id, text);
  await setStatus(acc.id, true);
  return { accountId: acc.id, events: n };
}

async function importIcs(userId: string, calendarId: string, text: string, now = new Date()): Promise<number> {
  const { events } = parseIcs(text, { defaultTz: await userTz(userId), now });
  const existing = await db.event.findMany({ where: { calendarId, externalId: { not: null } }, select: { id: true, externalId: true } });
  const have = new Map(existing.map((e) => [e.externalId!, e.id]));
  const keep = new Set(events.map((e) => e.key));
  await db.$transaction(async (tx) => {
    const stale = existing.filter((e) => !keep.has(e.externalId!)).map((e) => e.id);
    if (stale.length) await tx.event.deleteMany({ where: { id: { in: stale } } });
    for (const e of events) {
      const data = { title: e.title, description: e.description, location: e.location, startsAt: e.startsAt, endsAt: e.endsAt, allDay: e.allDay };
      const id = have.get(e.key);
      if (id) await tx.event.update({ where: { id }, data });
      else await tx.event.create({ data: { calendarId, externalId: e.key, ...data } });
    }
  });
  return events.length;
}

export async function syncCalendar(userId: string, accountId: string, now = new Date()) {
  const acc = (await db.account.findFirst({ where: { id: accountId, userId, provider: 'ics', kind: 'calendar' } })) ?? fail('Conexión no encontrada');
  const cal = (await db.calendar.findFirst({ where: { accountId: acc.id, userId } })) ?? fail('Calendario no encontrado');
  try {
    const { text } = await safeFetchText(decrypt(acc.accessTokenEnc!), { accept: 'text/calendar, text/plain, */*' });
    if (!/BEGIN:VCALENDAR/i.test(text)) throw new ServiceError('La dirección ya no devuelve un calendario válido');
    const n = await importIcs(userId, cal.id, text, now);
    await setStatus(acc.id, true);
    return n;
  } catch (e) {
    await setStatus(acc.id, false, e instanceof ServiceError ? e.message : 'No se pudo sincronizar');
    return e instanceof ServiceError ? fail(e.message) : fail('No se pudo sincronizar');
  }
}

// ───────────── Noticias (RSS/Atom por URL) ─────────────

export async function addNewsFeed(userId: string, input: unknown) {
  const p = feedSchema.safeParse(input);
  if (!p.success) return fail(issue(p.error));
  const checked = checkUserUrl(p.data.url);
  if (!checked.ok) return fail(checked.error);
  if ((await db.account.count({ where: { userId, provider: 'rss', kind: 'news' } })) >= LIMITS.feeds) return fail(`Máximo ${LIMITS.feeds} feeds`);
  const url = checked.url.toString();
  const externalId = hash(url);
  if (await db.account.findFirst({ where: { userId, provider: 'rss', kind: 'news', externalId } })) return fail('Ya sigues ese feed');
  const { text } = await safeFetchText(url, { accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' });
  const feed = parseFeed(text);
  if (feed.items.length === 0) return fail('No se han encontrado noticias: ¿es un feed RSS o Atom válido?');
  const label = p.data.name || feed.title || new URL(url).hostname;
  const acc = await db.account.create({ data: { userId, provider: 'rss', kind: 'news', externalId, label: label.slice(0, 80), accessTokenEnc: encrypt(url), scope: p.data.category, status: 'connected' } });
  const n = await importFeed(userId, acc.id, label, p.data.category, feed.items);
  await setStatus(acc.id, true);
  return { accountId: acc.id, articles: n };
}

async function importFeed(userId: string, accountId: string, source: string, category: string, items: ReturnType<typeof parseFeed>['items']): Promise<number> {
  const have = new Set((await db.newsArticle.findMany({ where: { userId, accountId, externalId: { in: items.map((i) => i.externalId) } }, select: { externalId: true } })).map((a) => a.externalId));
  const fresh = items.filter((i) => !have.has(i.externalId));
  if (fresh.length) await db.newsArticle.createMany({ data: fresh.map((i) => ({ userId, accountId, externalId: i.externalId, category, title: i.title, source: source.slice(0, 80), url: i.url, imageUrl: i.imageUrl, summary: i.summary || i.title, importance: 50, publishedAt: i.publishedAt })) });
  // Mantenimiento: artículos importados de más de 60 días.
  await db.newsArticle.deleteMany({ where: { userId, accountId, publishedAt: { lt: new Date(Date.now() - 60 * 86_400_000) } } });
  return fresh.length;
}

export async function syncNewsFeed(userId: string, accountId: string) {
  const acc = (await db.account.findFirst({ where: { id: accountId, userId, provider: 'rss', kind: 'news' } })) ?? fail('Conexión no encontrada');
  try {
    const { text } = await safeFetchText(decrypt(acc.accessTokenEnc!), { accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' });
    const feed = parseFeed(text);
    if (feed.items.length === 0) throw new ServiceError('El feed no contiene noticias válidas');
    const n = await importFeed(userId, acc.id, acc.label ?? 'Feed', acc.scope ?? 'mundo', feed.items);
    await setStatus(acc.id, true);
    return n;
  } catch (e) {
    await setStatus(acc.id, false, e instanceof ServiceError ? e.message : 'No se pudo sincronizar');
    return e instanceof ServiceError ? fail(e.message) : fail('No se pudo sincronizar');
  }
}

/** Desconecta: borra la conexión, el calendario suscrito con sus eventos importados, o los artículos del feed. */
export async function removeConnection(userId: string, accountId: string) {
  const acc = (await db.account.findFirst({ where: { id: accountId, userId, provider: { in: ['ics', 'rss'] } } })) ?? fail('Conexión no encontrada');
  await db.$transaction([db.calendar.deleteMany({ where: { accountId: acc.id, userId } }), db.account.delete({ where: { id: acc.id } })]);
}

export async function listConnections(userId: string) {
  const rows = await db.account.findMany({ where: { userId, provider: { in: ['ics', 'rss'] } }, orderBy: { createdAt: 'asc' } });
  return rows.map((a) => ({ id: a.id, kind: a.kind as 'calendar' | 'news', label: a.label ?? '', category: a.scope, status: a.status, lastSyncAt: a.lastSyncAt?.toISOString() ?? null, lastError: a.lastError }));
}

/** Para el planificador: sincroniza las conexiones más antiguas (más de `staleMs` sin sincronizar). Errores aislados por conexión. */
export async function syncDue(now = new Date(), staleMs = 3_600_000, limit = 50) {
  const due = await db.account.findMany({ where: { provider: { in: ['ics', 'rss'] }, OR: [{ lastSyncAt: null }, { lastSyncAt: { lt: new Date(now.getTime() - staleMs) } }] }, orderBy: { lastSyncAt: { sort: 'asc', nulls: 'first' } }, take: limit });
  let ok = 0, failed = 0;
  for (const a of due) {
    try { await (a.provider === 'ics' ? syncCalendar(a.userId, a.id, now) : syncNewsFeed(a.userId, a.id)); ok++; } catch { failed++; }
  }
  return { ok, failed };
}
