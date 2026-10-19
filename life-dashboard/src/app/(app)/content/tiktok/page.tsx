import { ContentView } from '@/components/content/content-view';
import { requireUser } from '@/server/auth';
import { listContentPosts } from '@/server/life/content';

export const metadata = { title: 'TikTok' };
export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await requireUser();
  return <ContentView platform="tiktok" posts={await listContentPosts(user.id, 'tiktok')} />;
}
