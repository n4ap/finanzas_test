import { db } from '@/lib/db';
import { BottomNav, Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { requireUser } from '@/server/auth';
import { getWeather } from '@/server/weather';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [weather, notifications] = await Promise.all([
    getWeather(user.city),
    db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 20 }),
  ]);
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} weather={weather} notifications={notifications.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() }))} />
        <main className="flex-1 px-4 py-5 pb-24 sm:px-6 lg:pb-8">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
