import { CompetitorsView } from '@/components/content/competitors-view';
import { requireUser } from '@/server/auth';
import { listCompetitors } from '@/server/life/content';

export const metadata = { title: 'Competencia' };
export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await requireUser();
  return <CompetitorsView competitors={await listCompetitors(user.id)} />;
}
