import { FocusView } from '@/components/focus-view';
import { requireUser } from '@/server/auth';
import { getDashboardData } from '@/server/dashboard-data';
import { endOfDay, startOfDay } from '@/lib/utils';

export const metadata = { title: 'Focus' };
export const dynamic = 'force-dynamic';

export default async function FocusPage() {
  const user = await requireUser();
  const d = await getDashboardData(user.id);
  const cur = d.tasks.find((t) => t.status === 'in_progress') ?? d.tasks.find((t) => t.id === d.nextAction.taskId) ?? null;
  const next = d.events.find((e) => e.startsAt > d.now);
  const dueToday = d.tasks.filter((t) => t.dueDate && t.dueDate >= startOfDay(d.now) && t.dueDate <= endOfDay(d.now));
  const doneToday = d.tasks.filter((t) => t.completedAt && t.completedAt >= startOfDay(d.now));
  return (
    <FocusView
      nextActionMessage={d.nextAction.message}
      current={cur ? { title: cur.title, estimateMinutes: cur.estimateMinutes } : null}
      nextEvent={next ? { title: next.title, startsAt: next.startsAt.toISOString() } : null}
      goal={{ done: doneToday.length + dueToday.filter((t) => t.status === 'done').length, total: dueToday.length + doneToday.length }}
    />
  );
}
