import { WidgetGrid } from '@/components/widgets/widget-grid';
import { renderWidgets } from '@/components/widgets/registry';
import { db } from '@/lib/db';
import { mergeLayout, type WidgetState } from '@/lib/widgets';
import { requireUser } from '@/server/auth';
import { getDashboardData } from '@/server/dashboard-data';

export const metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await requireUser();
  const [data, saved] = await Promise.all([getDashboardData(user.id), db.dashboardLayout.findUnique({ where: { userId: user.id } })]);
  const layout = mergeLayout(saved?.widgets as WidgetState[] | undefined);
  return <WidgetGrid initial={layout} widgets={renderWidgets(data)} />;
}
