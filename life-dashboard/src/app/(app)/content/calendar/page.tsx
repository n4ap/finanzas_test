import { CalendarView } from '@/components/content/calendar-view';
import { dayKeyOf, isMonth } from '@/lib/content';
import { requireUser } from '@/server/auth';
import { listContentPosts } from '@/server/life/content';

export const metadata = { title: 'Calendario editorial' };
export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const user = await requireUser();
  const { m } = await searchParams;
  const today = dayKeyOf(new Date().toISOString());
  return <CalendarView month={isMonth(m) ? m : today.slice(0, 7)} today={today} posts={await listContentPosts(user.id)} />;
}
