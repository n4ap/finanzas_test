import { InvestmentsView } from '@/components/investments/investments-view';
import { requireUser } from '@/server/auth';
import { getInvestmentsOverview } from '@/server/finance/queries';

export const metadata = { title: 'Inversiones' };
export const dynamic = 'force-dynamic';

export default async function InvestmentsPage() {
  const user = await requireUser();
  return <InvestmentsView o={await getInvestmentsOverview(user.id)} />;
}
