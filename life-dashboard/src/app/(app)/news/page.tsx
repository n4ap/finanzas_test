import { NewsView } from '@/components/news/news-view';
import type { NewsDTO } from '@/components/news/types';
import { db } from '@/lib/db';
import { requireUser } from '@/server/auth';
import { rankNews, shortSummary, topOfToday } from '@/server/news-rank';

export const metadata = { title: 'Noticias' };
export const dynamic = 'force-dynamic';

export default async function NewsPage() {
  const user = await requireUser();
  const now = new Date();
  const rows = await db.newsArticle.findMany({ where: { userId: user.id }, orderBy: { publishedAt: 'desc' }, take: 150 });
  const followed = ((user.preferences as { followedNews?: string[] } | null)?.followedNews ?? []).filter((f) => typeof f === 'string');
  const dto = (r: (typeof rows)[number]): NewsDTO => ({
    id: r.id, category: r.category, title: r.title, source: r.source, url: r.url, imageUrl: r.imageUrl, summary: r.summary,
    shortSummary: r.aiSummary ?? shortSummary(r.summary), publishedAt: r.publishedAt.toISOString(),
  });
  const top = topOfToday(rows, followed, now).map(dto);
  const topIds = new Set(top.map((t) => t.id));
  const rest = rankNews(rows.filter((r) => !topIds.has(r.id)), followed, now).map(dto);
  return <NewsView top={top} articles={[...top, ...rest]} followed={followed} />;
}
