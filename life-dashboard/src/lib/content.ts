/** Estudio de contenido (YouTube y TikTok): plataformas, tipos, estados y la lógica pura de cada sección. */
export const PLATFORMS = ['youtube', 'tiktok'] as const;
export type Platform = (typeof PLATFORMS)[number];

export const POST_TYPES = ['video', 'short', 'carousel', 'photo', 'live', 'story', 'community'] as const;
export type PostType = (typeof POST_TYPES)[number];
export const POST_TYPE_LABEL: Record<PostType, string> = { video: 'Vídeo', short: 'Short', carousel: 'Carrusel', photo: 'Foto', live: 'Directo', story: 'Historia', community: 'Comunidad' };

/** Lo propio de cada plataforma: tipos admitidos y límites de texto (título y descripción/subtítulo). */
export const PLATFORM_META: Record<Platform, { label: string; types: readonly PostType[]; titleMax: number; captionMax: number; captionLabel: string; color: string }> = {
  youtube: { label: 'YouTube', types: ['video', 'short', 'live', 'community'], titleMax: 100, captionMax: 5000, captionLabel: 'Descripción', color: 'var(--series-2)' },
  tiktok: { label: 'TikTok', types: ['video', 'carousel', 'photo', 'live', 'story'], titleMax: 120, captionMax: 2200, captionLabel: 'Subtítulo (texto de la publicación)', color: 'var(--series-1)' },
};
export const platformLabel = (p: string) => PLATFORM_META[p as Platform]?.label ?? p;

export const POST_STATUSES = ['idea', 'draft', 'scheduled', 'published'] as const;
export type PostStatus = (typeof POST_STATUSES)[number];
export const POST_STATUS_LABEL: Record<PostStatus, string> = { idea: 'Idea', draft: 'Borrador', scheduled: 'Programada', published: 'Publicada' };

/** Límite máximo de texto de cualquier plataforma (el de cada una está en PLATFORM_META). */
export const CAPTION_MAX = 5000;

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

// ───────── Fechas (en hora de España, la del usuario) ─────────
export const CONTENT_TZ = 'Europe/Madrid';
/** 'AAAA-MM-DD' del instante en hora de España. */
export const dayKeyOf = (iso: string) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: CONTENT_TZ });
/** Fecha que manda en el calendario: la de publicación si ya se publicó; si no, la programada o prevista. */
export const postDate = (p: Pick<PostLite, 'status' | 'scheduledAt' | 'publishedAt'>) => (p.status === 'published' ? p.publishedAt ?? p.scheduledAt : p.scheduledAt);

const addDaysKey = (key: string, n: number) => { const d = new Date(`${key}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
/** Semanas (lunes a domingo) que cubren el mes 'AAAA-MM', con los días sobrantes de los meses vecinos. */
export function monthGrid(month: string): string[][] {
  const first = `${month}-01`;
  const lead = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7;
  let day = addDaysKey(first, -lead);
  const weeks: string[][] = [];
  do {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDaysKey(day, i)));
    day = addDaysKey(day, 7);
  } while (day.slice(0, 7) === month);
  return weeks;
}
export const shiftMonth = (month: string, n: number) => { const d = new Date(`${month}-15T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 7); };
export const isMonth = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

// ───────── Análisis ─────────
export interface PostStats extends PostLite { id: string; platform: Platform; type: PostType; views: number | null; likes: number | null; comments: number | null; shares: number | null }
const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const sum = (xs: (number | null)[]) => xs.reduce<number>((a, b) => a + (b ?? 0), 0);

/**
 * Resultados de lo publicado en el periodo: totales, interacción (me gusta + comentarios + compartidos sobre visualizaciones),
 * evolución por semanas, media por tipo y por día de la semana, y las publicaciones con más visualizaciones.
 * Las medias solo cuentan publicaciones con visualizaciones anotadas.
 */
export function contentAnalytics<T extends PostStats>(posts: T[], opts: { platform: Platform | null; days: number | null }, now: Date) {
  const from = opts.days ? now.getTime() - opts.days * 86_400_000 : -Infinity;
  const pub = posts.filter((p) => p.status === 'published' && p.publishedAt && (!opts.platform || p.platform === opts.platform) && new Date(p.publishedAt).getTime() >= from);
  const measured = pub.filter((p) => p.views !== null);
  const views = sum(measured.map((p) => p.views)), interactions = sum(measured.flatMap((p) => [p.likes, p.comments, p.shares]));
  const avg = (xs: T[]) => (xs.length ? Math.round(sum(xs.map((p) => p.views)) / xs.length) : null);

  const weekStart = (key: string) => addDaysKey(key, -((new Date(`${key}T12:00:00Z`).getUTCDay() + 6) % 7));
  const thisWeek = weekStart(dayKeyOf(now.toISOString()));
  const weekly = Array.from({ length: 12 }, (_, i) => addDaysKey(thisWeek, (i - 11) * 7)).map((w) => {
    const inWeek = pub.filter((p) => weekStart(dayKeyOf(p.publishedAt!)) === w);
    return { week: w, label: new Date(`${w}T12:00:00Z`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' }).replace(/\./g, ''), posts: inWeek.length, views: sum(inWeek.map((p) => p.views)) };
  });
  const byType = POST_TYPES.map((t) => ({ type: t, posts: pub.filter((p) => p.type === t).length, avgViews: avg(measured.filter((p) => p.type === t)) })).filter((r) => r.posts > 0).sort((a, b) => (b.avgViews ?? -1) - (a.avgViews ?? -1));
  const byWeekday = WEEKDAYS.map((day, i) => {
    const on = measured.filter((p) => (new Date(`${dayKeyOf(p.publishedAt!)}T12:00:00Z`).getUTCDay() + 6) % 7 === i);
    return { day, posts: on.length, avgViews: avg(on) };
  });
  const best = byWeekday.filter((d) => d.avgViews !== null).sort((a, b) => b.avgViews! - a.avgViews!)[0] ?? null;
  return {
    published: pub.length, measured: measured.length, views, likes: sum(measured.map((p) => p.likes)), comments: sum(measured.map((p) => p.comments)), shares: sum(measured.map((p) => p.shares)),
    avgViews: avg(measured), engagement: views > 0 ? interactions / views : null,
    weekly, byType, byWeekday, bestWeekday: best?.day ?? null,
    top: [...measured].sort((a, b) => b.views! - a.views!).slice(0, 5),
  };
}

// ───────── Competencia ─────────
export interface SnapshotLite { date: string; followers: number; avgViews: number | null; posts: number | null }
/** Último dato, cambio desde el anterior y crecimiento en ~30 días (frente al dato más cercano a hace 30 días, si es de hace al menos 7). */
export function competitorTrend(snapshots: SnapshotLite[]) {
  const s = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const last = s.at(-1) ?? null, prev = s.at(-2) ?? null;
  if (!last) return { last: null, change: null, changePct: null, growth30: null, growth30Pct: null };
  const lastT = new Date(last.date).getTime();
  const ref = s.slice(0, -1).filter((x) => lastT - new Date(x.date).getTime() >= 7 * 86_400_000)
    .sort((a, b) => Math.abs(lastT - new Date(a.date).getTime() - 30 * 86_400_000) - Math.abs(lastT - new Date(b.date).getTime() - 30 * 86_400_000))[0];
  const pct = (a: number, b: number) => (b > 0 ? (a - b) / b : null);
  return {
    last, change: prev ? last.followers - prev.followers : null, changePct: prev ? pct(last.followers, prev.followers) : null,
    growth30: ref ? last.followers - ref.followers : null, growth30Pct: ref ? pct(last.followers, ref.followers) : null,
  };
}

// ───────── Noticias del sector ─────────
const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
/** Palabras clave (sin repetir, sin distinguir mayúsculas ni tildes) que aparecen como palabra completa en el texto. */
export function matchKeywords(text: string, keywords: string[]): string[] {
  const t = fold(text);
  return keywords.filter((k, i) => {
    const f = fold(k.trim());
    if (!f || keywords.findIndex((x) => fold(x.trim()) === f) !== i) return false;
    return new RegExp(`(^|[^a-z0-9])${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9])`).test(t);
  });
}
export const DEFAULT_CONTENT_KEYWORDS = ['YouTube', 'TikTok', 'redes sociales', 'creadores', 'aviación'];
