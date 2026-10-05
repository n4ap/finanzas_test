import 'server-only';
import { db } from '@/lib/db';
import { accessibleAccountsWhere } from './finance/core';

export interface SearchHit { id: string; group: string; title: string; subtitle?: string; href: string }

/** Búsqueda global. Siempre acotada al usuario; devuelve hasta `limit` resultados por grupo. */
export async function globalSearch(userId: string, q: string, limit = 4): Promise<SearchHit[]> {
  const c = { contains: q, mode: 'insensitive' as const };
  const [emails, tasks, events, projects, txs, news, trips, positions] = await Promise.all([
    db.email.findMany({ where: { userId, OR: [{ subject: c }, { fromName: c }, { body: c }] }, take: limit, orderBy: { receivedAt: 'desc' } }),
    db.task.findMany({ where: { userId, OR: [{ title: c }, { description: c }] }, take: limit, orderBy: { updatedAt: 'desc' } }),
    db.event.findMany({ where: { calendar: { userId }, OR: [{ title: c }, { location: c }, { description: c }] }, take: limit, orderBy: { startsAt: 'desc' } }),
    db.project.findMany({ where: { userId, OR: [{ name: c }, { description: c }] }, take: limit }),
    db.transaction.findMany({ where: { account: accessibleAccountsWhere(userId), OR: [{ description: c }, { merchant: c }, { category: c }] }, take: limit, orderBy: { date: 'desc' } }),
    db.newsArticle.findMany({ where: { userId, OR: [{ title: c }, { summary: c }] }, take: limit, orderBy: { publishedAt: 'desc' } }),
    db.trip.findMany({ where: { userId, OR: [{ name: c }, { destination: c }] }, take: limit }),
    db.investment.findMany({ where: { portfolio: { userId }, OR: [{ symbol: c }, { name: c }] }, take: limit }),
  ]);
  const fmt = (d: Date) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  return [
    ...emails.map((e) => ({ id: e.id, group: 'Emails', title: e.subject, subtitle: e.fromName, href: '/email' })),
    ...tasks.map((t) => ({ id: t.id, group: 'Tareas', title: t.title, subtitle: t.status, href: '/tasks' })),
    ...events.map((e) => ({ id: e.id, group: 'Eventos', title: e.title, subtitle: fmt(e.startsAt), href: '/calendar' })),
    ...projects.map((p) => ({ id: p.id, group: 'Proyectos', title: p.name, subtitle: p.status, href: '/projects' })),
    ...txs.map((t) => ({ id: t.id, group: 'Finanzas', title: t.description, subtitle: `${Number(t.amount).toFixed(2)} € · ${fmt(t.date)}`, href: '/finance' })),
    ...news.map((n) => ({ id: n.id, group: 'Noticias', title: n.title, subtitle: n.source, href: '/news' })),
    ...positions.map((p) => ({ id: p.id, group: 'Inversiones', title: `${p.symbol} · ${p.name}`, subtitle: p.assetType, href: '/investments' })),
    ...trips.map((t) => ({ id: t.id, group: 'Viajes', title: t.name, subtitle: t.destination, href: `/travel/${t.id}` })),
  ];
}
