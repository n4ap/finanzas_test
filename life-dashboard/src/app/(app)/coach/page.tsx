import { CoachView } from '@/components/coach/coach-view';
import { COACH_TABS, type CoachTab } from '@/components/coach/types';
import { requireUser } from '@/server/auth';
import { getCoachData } from '@/server/coach/queries';

export const metadata = { title: 'Coach' };
export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const user = await requireUser();
  const d = await getCoachData(user.id);
  const initial = (COACH_TABS as readonly string[]).includes(tab ?? '') ? (tab as CoachTab) : d.interview.answered === 0 ? 'mapa' : 'panel';
  return <CoachView d={d} initialTab={initial} />;
}
