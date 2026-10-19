import 'server-only';
import { db } from '@/lib/db';
import { normalizeHashtags, type PostStatus, type PostType } from '@/lib/content';
import { contentPostSchema, contentStatusSchema } from '@/lib/validation-life';
import { LIMITS, fail, issue } from './core';

const PLATFORM = 'tiktok';

export interface ContentPostDTO {
  id: string; title: string; caption: string | null; hashtags: string | null; type: PostType; status: PostStatus;
  scheduledAt: string | null; publishedAt: string | null; notes: string | null; createdAt: string;
}

/** Al publicar se guarda la fecha real (la indicada, la programada si ya pasó, o ahora). */
const postData = (p: ReturnType<typeof contentPostSchema.parse>, now = new Date()) => {
  const scheduledAt = p.scheduledAt ? new Date(p.scheduledAt) : null;
  const publishedAt = p.status !== 'published' ? null
    : p.publishedAt ? new Date(p.publishedAt) : scheduledAt && scheduledAt <= now ? scheduledAt : now;
  return { title: p.title, caption: p.caption ?? null, hashtags: p.hashtags ? normalizeHashtags(p.hashtags) || null : null, type: p.type, status: p.status, scheduledAt, publishedAt, notes: p.notes ?? null };
};

export async function listContentPosts(userId: string): Promise<ContentPostDTO[]> {
  const rows = await db.contentPost.findMany({ where: { userId, platform: PLATFORM }, orderBy: { createdAt: 'desc' } });
  return rows.map((r) => ({
    id: r.id, title: r.title, caption: r.caption, hashtags: r.hashtags, type: r.type as PostType, status: r.status as PostStatus,
    scheduledAt: r.scheduledAt?.toISOString() ?? null, publishedAt: r.publishedAt?.toISOString() ?? null, notes: r.notes, createdAt: r.createdAt.toISOString(),
  }));
}

export async function createContentPost(userId: string, input: unknown) {
  const p = contentPostSchema.safeParse(input);
  if (!p.success) return fail(issue(p.error));
  if ((await db.contentPost.count({ where: { userId } })) >= LIMITS.contentPosts) return fail('Has alcanzado el máximo de publicaciones');
  return (await db.contentPost.create({ data: { userId, platform: PLATFORM, ...postData(p.data) } })).id;
}

export async function updateContentPost(userId: string, id: string, input: unknown) {
  const p = contentPostSchema.safeParse(input);
  if (!p.success) return fail(issue(p.error));
  const r = await db.contentPost.updateMany({ where: { id, userId }, data: postData(p.data) });
  if (r.count === 0) fail('Publicación no encontrada');
}

/** Cambio rápido de estado desde la tarjeta (p. ej. «Marcar publicada»). */
export async function setContentStatus(userId: string, id: string, status: unknown) {
  const s = contentStatusSchema.safeParse(status);
  if (!s.success) return fail('Estado no válido');
  const post = (await db.contentPost.findFirst({ where: { id, userId } })) ?? fail('Publicación no encontrada');
  if (s.data === 'scheduled' && !post.scheduledAt) return fail('Edítala para ponerle fecha y hora antes de programarla');
  const now = new Date();
  const publishedAt = s.data !== 'published' ? null : post.scheduledAt && post.scheduledAt <= now ? post.scheduledAt : now;
  await db.contentPost.update({ where: { id }, data: { status: s.data, publishedAt } });
}

export async function deleteContentPost(userId: string, id: string) {
  const r = await db.contentPost.deleteMany({ where: { id, userId } });
  if (r.count === 0) fail('Publicación no encontrada');
}
