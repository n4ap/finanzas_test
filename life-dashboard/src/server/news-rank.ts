export interface RankableArticle { id: string; category: string; importance: number; publishedAt: Date }

const HOUR = 3_600_000;

/** Puntuación: importancia (0-100) + frescura (hasta 30, decae en 24 h) + bonus por categorías seguidas. */
export function scoreArticle(a: RankableArticle, followed: string[], now: Date): number {
  const ageH = Math.max(0, (now.getTime() - a.publishedAt.getTime()) / HOUR);
  const freshness = 30 * Math.max(0, 1 - ageH / 24);
  const follow = followed.includes(a.category) ? 25 : 0;
  return a.importance + freshness + follow;
}

export const rankNews = <T extends RankableArticle>(items: T[], followed: string[], now: Date): T[] =>
  [...items].sort((x, y) => scoreArticle(y, followed, now) - scoreArticle(x, followed, now));

/** «Lo importante de hoy»: máximo `limit` noticias, como mucho `perCategory` por categoría, solo de las últimas 36 h. */
export function topOfToday<T extends RankableArticle>(items: T[], followed: string[], now: Date, limit = 5, perCategory = 2): T[] {
  const recent = items.filter((a) => now.getTime() - a.publishedAt.getTime() < 36 * HOUR);
  const used = new Map<string, number>();
  const out: T[] = [];
  for (const a of rankNews(recent, followed, now)) {
    if ((used.get(a.category) ?? 0) >= perCategory) continue;
    used.set(a.category, (used.get(a.category) ?? 0) + 1);
    out.push(a);
    if (out.length === limit) break;
  }
  return out;
}

/** Resumen corto extractivo (≤ max caracteres, cortando en frase o palabra). */
export function shortSummary(text: string, max = 130): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  const first = clean.split(/(?<=[.!?])\s+/)[0] ?? clean;
  if (first.length <= max) return first;
  const cut = first.slice(0, max - 1);
  return cut.slice(0, cut.lastIndexOf(' ') > 60 ? cut.lastIndexOf(' ') : cut.length).replace(/[,;:\s]+$/, '') + '…';
}
