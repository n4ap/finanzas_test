import { AnalyticsView } from '@/components/content/analytics-view';
import { requireUser } from '@/server/auth';
import { listContentPosts } from '@/server/life/content';

export const metadata = { title: 'Análisis de contenido' };
export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await requireUser();
  return <AnalyticsView posts={await listContentPosts(user.id)} />;
}
