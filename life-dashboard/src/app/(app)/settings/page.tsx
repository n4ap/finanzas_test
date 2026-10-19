import { cookies } from 'next/headers';
import { SettingsView } from '@/components/settings/settings-view';
import { sha256 } from '@/lib/crypto';
import { SESSION_COOKIE, requireUser } from '@/server/auth';
import { getSettingsData } from '@/server/settings/queries';

export const metadata = { title: 'Ajustes' };
export const dynamic = 'force-dynamic';

const TABS = ['profile', 'connections', 'ai', 'security', 'data'] as const;

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const user = await requireUser();
  const token = (await cookies()).get(SESSION_COOKIE)?.value ?? '';
  const data = await getSettingsData(user.id, sha256(token));
  return <SettingsView d={data} initialTab={(TABS as readonly string[]).includes(tab ?? '') ? (tab as (typeof TABS)[number]) : 'profile'} />;
}
