import 'server-only';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { normalizeHashtags, type Platform, type PostStatus, type PostType } from '@/lib/content';
import { competitorSchema, contentKeywordsSchema, contentPostSchema, contentStatusSchema, snapshotSchema } from '@/lib/validation-life';
import { LIMITS, fail, issue, toNoon } from './core';

export interface ContentPostDTO {
  id: string; platform: Platform; title: string; caption: string | null; hashtags: string | null; type: PostType; status: PostStatus;
  scheduledAt: string | null; publishedAt: string | null; notes: string | null; createdAt: string;
  views: number | null; likes: number | null; comments: number | null; shares: number | null;
}

/** Al publicar se guarda la fecha real (la indicada, la programada si ya pasó, o ahora). Los resultados solo tienen sentido publicada. */
const postData = (p: ReturnType<typeof contentPostSchema.parse>, now = new Date()) => {
  const scheduledAt = p.scheduledAt ? new Date(p.scheduledAt) : null;
  const published = p.status === 'published';
  const publishedAt = !published ? null : p.publishedAt ? new Date(p.publishedAt) : scheduledAt && scheduledAt <= now ? scheduledAt : now;
  return {
    title: p.title, caption: p.caption ?? null, hashtags: p.hashtags ? normalizeHashtags(p.hashtags) || null : null, type: p.type, status: p.status, scheduledAt, publishedAt, notes: p.notes ?? null,
    views: published ? p.views ?? null : null, likes: published ? p.likes ?? null : null, comments: published ? p.comments ?? null : null, shares: published ? p.shares ?? null : null,
  };
};

export async function listContentPosts(userId: string, platform?: Platform): Promise<ContentPostDTO[]> {
  const rows = await db.contentPost.findMany({ where: { userId, ...(platform ? { platform } : {}) }, orderBy: { createdAt: 'desc' } });
  return rows.map((r) => ({
    id: r.id, platform: r.platform as Platform, title: r.title, caption: r.caption, hashtags: r.hashtags, type: r.type as PostType, status: r.status as PostStatus,
    scheduledAt: r.scheduledAt?.toISOString() ?? null, publishedAt: r.publishedAt?.toISOString() ?? null, notes: r.notes, createdAt: r.createdAt.toISOString(),
    views: r.views, likes: r.likes, comments: r.comments, shares: r.shares,
  }));
}

export async function createContentPost(userId: string, input: unknown) {
  const p = contentPostSchema.safeParse(input);
  if (!p.success) return fail(issue(p.error));
  if ((await db.contentPost.count({ where: { userId } })) >= LIMITS.contentPosts) return fail('Has alcanzado el máximo de publicaciones');
  return (await db.contentPost.create({ data: { userId, platform: p.data.platform, ...postData(p.data) } })).id;
}

/** La plataforma no cambia al editar: se valida con la de la publicación guardada. */
export async function updateContentPost(userId: string, id: string, input: unknown) {
  const post = (await db.contentPost.findFirst({ where: { id, userId }, select: { platform: true } })) ?? fail('Publicación no encontrada');
  const p = contentPostSchema.safeParse({ ...(input && typeof input === 'object' ? input : {}), platform: post.platform });
  if (!p.success) return fail(issue(p.error));
  await db.contentPost.update({ where: { id }, data: postData(p.data) });
}

/** Cambio rápido de estado desde la tarjeta (p. ej. «Marcar publicada»). */
export async function setContentStatus(userId: string, id: string, status: unknown) {
  const s = contentStatusSchema.safeParse(status);
  if (!s.success) return fail('Estado no válido');
  const post = (await db.contentPost.findFirst({ where: { id, userId } })) ?? fail('Publicación no encontrada');
  if (s.data === 'scheduled' && !post.scheduledAt) return fail('Edítala para ponerle fecha y hora antes de programarla');
  const now = new Date();
  const published = s.data === 'published';
  const publishedAt = !published ? null : post.publishedAt ?? (post.scheduledAt && post.scheduledAt <= now ? post.scheduledAt : now);
  await db.contentPost.update({ where: { id }, data: { status: s.data, publishedAt, ...(published ? {} : { views: null, likes: null, comments: null, shares: null }) } });
}

export async function deleteContentPost(userId: string, id: string) {
  const r = await db.contentPost.deleteMany({ where: { id, userId } });
  if (r.count === 0) fail('Publicación no encontrada');
}

// ───────── Competencia ─────────
export interface SnapshotDTO { id: string; date: string; followers: number; avgViews: number | null; posts: number | null }
export interface CompetitorDTO { id: string; platform: Platform; name: string; handle: string | null; url: string | null; notes: string | null; mine: boolean; snapshots: SnapshotDTO[] }

export async function listCompetitors(userId: string): Promise<CompetitorDTO[]> {
  const rows = await db.competitor.findMany({ where: { userId }, include: { snapshots: { orderBy: { date: 'asc' } } }, orderBy: [{ mine: 'desc' }, { name: 'asc' }] });
  return rows.map((c) => ({
    id: c.id, platform: c.platform as Platform, name: c.name, handle: c.handle, url: c.url, notes: c.notes, mine: c.mine,
    snapshots: c.snapshots.map((s) => ({ id: s.id, date: s.date.toISOString().slice(0, 10), followers: s.followers, avgViews: s.avgViews, posts: s.posts })),
  }));
}

const competitorData = (c: ReturnType<typeof competitorSchema.parse>) => ({ platform: c.platform, name: c.name, handle: c.handle ? c.handle.replace(/^@+/, '') : null, url: c.url ?? null, notes: c.notes ?? null, mine: c.mine });

export async function createCompetitor(userId: string, input: unknown) {
  const p = competitorSchema.safeParse(input);
  if (!p.success) return fail(issue(p.error));
  if ((await db.competitor.count({ where: { userId } })) >= LIMITS.competitors) return fail('Has alcanzado el máximo de cuentas seguidas');
  return (await db.competitor.create({ data: { userId, ...competitorData(p.data) } })).id;
}

export async function updateCompetitor(userId: string, id: string, input: unknown) {
  const p = competitorSchema.safeParse(input);
  if (!p.success) return fail(issue(p.error));
  const r = await db.competitor.updateMany({ where: { id, userId }, data: competitorData(p.data) });
  if (r.count === 0) fail('Cuenta no encontrada');
}

export async function deleteCompetitor(userId: string, id: string) {
  const r = await db.competitor.deleteMany({ where: { id, userId } });
  if (r.count === 0) fail('Cuenta no encontrada');
}

/** Anota los datos de un día (si ya había ese día, se sustituyen). */
export async function addSnapshot(userId: string, competitorId: string, input: unknown) {
  const p = snapshotSchema.safeParse(input);
  if (!p.success) return fail(issue(p.error));
  if (!(await db.competitor.findFirst({ where: { id: competitorId, userId }, select: { id: true } }))) return fail('Cuenta no encontrada');
  if ((await db.competitorSnapshot.count({ where: { competitorId } })) >= LIMITS.snapshots) return fail('Demasiados datos en esta cuenta');
  const date = toNoon(p.data.date);
  const data = { followers: p.data.followers, avgViews: p.data.avgViews ?? null, posts: p.data.posts ?? null };
  await db.competitorSnapshot.upsert({ where: { competitorId_date: { competitorId, date } }, create: { competitorId, date, ...data }, update: data });
}

export async function deleteSnapshot(userId: string, id: string) {
  const r = await db.competitorSnapshot.deleteMany({ where: { id, competitor: { userId } } });
  if (r.count === 0) fail('Dato no encontrado');
}

// ───────── Noticias del sector ─────────
export function contentKeywordsOf(preferences: unknown): string[] | null {
  const k = (preferences as { contentKeywords?: unknown } | null)?.contentKeywords;
  return Array.isArray(k) ? k.filter((x): x is string => typeof x === 'string') : null;
}

/** Guarda las palabras clave dentro de User.preferences sin pisar otras preferencias. */
export async function setContentKeywords(userId: string, input: unknown) {
  const p = contentKeywordsSchema.safeParse(input);
  if (!p.success) return fail(issue(p.error));
  const seen = new Set<string>();
  const keywords = p.data.filter((k) => !seen.has(k.toLowerCase()) && seen.add(k.toLowerCase()));
  const u = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { preferences: true } });
  await db.user.update({ where: { id: userId }, data: { preferences: { ...((u.preferences ?? {}) as Record<string, unknown>), contentKeywords: keywords } as Prisma.InputJsonValue } });
}
