/** Panel de contenido (TikTok): tipos, estados y la lógica pura de clasificación de publicaciones. */
export const POST_TYPES = ['video', 'carousel', 'photo', 'live', 'story'] as const;
export type PostType = (typeof POST_TYPES)[number];
export const POST_TYPE_LABEL: Record<PostType, string> = { video: 'Vídeo', carousel: 'Carrusel', photo: 'Foto', live: 'Directo (LIVE)', story: 'Historia' };

export const POST_STATUSES = ['idea', 'draft', 'scheduled', 'published'] as const;
export type PostStatus = (typeof POST_STATUSES)[number];
export const POST_STATUS_LABEL: Record<PostStatus, string> = { idea: 'Idea', draft: 'Borrador', scheduled: 'Programada', published: 'Publicada' };

/** Límite de caracteres del texto de una publicación de TikTok. */
export const CAPTION_MAX = 2200;

export interface PostLite { status: PostStatus; scheduledAt: string | null; publishedAt: string | null; createdAt: string; title: string }

/** Una programada cuya fecha ya pasó y no se ha marcado como publicada. */
export const isOverdue = (p: Pick<PostLite, 'status' | 'scheduledAt'>, now: Date) => p.status === 'scheduled' && !!p.scheduledAt && new Date(p.scheduledAt) < now;

const time = (s: string | null) => (s ? new Date(s).getTime() : Number.POSITIVE_INFINITY);

/**
 * Reparte las publicaciones en las secciones del panel:
 * programadas (la más próxima primero), borradores (ideas y borradores, lo más reciente primero),
 * publicadas (lo último primero) y el registro de pendientes (todo lo no publicado: atrasadas, luego por fecha, sin fecha al final).
 */
export function contentBoard<T extends PostLite>(posts: T[], now: Date) {
  const scheduled = posts.filter((p) => p.status === 'scheduled').sort((a, b) => time(a.scheduledAt) - time(b.scheduledAt));
  const drafts = posts.filter((p) => p.status === 'idea' || p.status === 'draft').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const published = posts.filter((p) => p.status === 'published').sort((a, b) => (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt));
  const pending = posts.filter((p) => p.status !== 'published').sort((a, b) =>
    Number(isOverdue(b, now)) - Number(isOverdue(a, now)) || time(a.scheduledAt) - time(b.scheduledAt) || a.createdAt.localeCompare(b.createdAt));
  const weekEnd = now.getTime() + 7 * 86_400_000;
  return {
    scheduled, drafts, published, pending,
    stats: {
      scheduled: scheduled.length, drafts: drafts.length, published: published.length, pending: pending.length,
      overdue: pending.filter((p) => isOverdue(p, now)).length,
      thisWeek: scheduled.filter((p) => { const t = time(p.scheduledAt); return t >= now.getTime() && t <= weekEnd; }).length,
    },
  };
}

/** Normaliza hashtags: «viaje, #zaragoza  aviones» → «#viaje #zaragoza #aviones» (sin repetidos). */
export function normalizeHashtags(raw: string): string {
  const tags = raw.split(/[\s,;]+/).map((t) => t.replace(/^#+/, '').trim()).filter(Boolean);
  const seen = new Set<string>();
  return tags.filter((t) => !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase())).map((t) => `#${t}`).join(' ');
}
