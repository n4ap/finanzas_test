import { notFound } from 'next/navigation';
import { TripDetail } from '@/components/travel/trip-detail';
import { idSchema } from '@/lib/validation';
import { requireUser } from '@/server/auth';
import { getTrip } from '@/server/life/queries';

export const metadata = { title: 'Viaje' };
export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!idSchema.safeParse(id).success) notFound();
  const trip = await getTrip(user.id, id);
  if (!trip) notFound();
  return <TripDetail trip={trip} />;
}
