import { ContentNewsView, type ContentNewsItem } from '@/components/content/news-view';
import { db } from '@/lib/db';
import { DEFAULT_CONTENT_KEYWORDS, matchKeywords } from '@/lib/content';
import { requireUser } from '@/server/auth';
import { contentKeywordsOf } from '@/server/life/content';
import { shortSummary } from '@/server/news-rank';

export const metadata = { title: 'Noticias del sector' };
export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await requireUser();
  const keywords = contentKeywordsOf(user.preferences) ?? DEFAULT_CONTENT_KEYWORDS;
  const [rows, feeds] = await Promise.all([
    db.newsArticle.findMany({ where: { userId: user.id, publishedAt: { gte: new Date(Date.now() - 60 * 86_400_000) } }, orderBy: { publishedAt: 'desc' }, take: 1000 }),
    db.account.count({ where: { userId: user.id, kind: 'news' } }),
  ]);
  const items: ContentNewsItem[] = rows.flatMap((r) => {
    const matched = matchKeywords(`${r.title} ${r.summary}`, keywords);
    return matched.length ? [{ id: r.id, title: r.title, source: r.source, url: r.url, summary: r.aiSummary ?? shortSummary(r.summary), publishedAt: r.publishedAt.toISOString(), matched }] : [];
  }).slice(0, 150);
  return <ContentNewsView keywords={keywords} items={items} scanned={rows.length} feeds={feeds} />;
}
