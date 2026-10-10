import { HealthView } from '@/components/health/health-view';
import { requireUser } from '@/server/auth';
import { getHealthData } from '@/server/life/queries';

export const metadata = { title: 'Salud' };
export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await requireUser();
  return <HealthView d={await getHealthData(user.id)} />;
}
