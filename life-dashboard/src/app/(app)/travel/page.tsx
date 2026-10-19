import { TripsView } from '@/components/travel/trips-view';
import { requireUser } from '@/server/auth';
import { listTrips } from '@/server/life/queries';

export const metadata = { title: 'Viajes' };
export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await requireUser();
  return <TripsView trips={await listTrips(user.id)} />;
}
