import { ContentView } from '@/components/content/content-view';
import { requireUser } from '@/server/auth';
import { listContentPosts } from '@/server/life/content';

export const metadata = { title: 'YouTube' };
export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await requireUser();
  return <ContentView platform="youtube" posts={await listContentPosts(user.id, 'youtube')} />;
}
