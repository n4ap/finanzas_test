import { FamilyView } from '@/components/family/family-view';
import { requireUser } from '@/server/auth';
import { getFamilyData } from '@/server/life/queries';

export const metadata = { title: 'Familia' };
export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await requireUser();
  return <FamilyView d={await getFamilyData(user.id)} />;
}
