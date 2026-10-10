import { FinanceView } from '@/components/finance/finance-view';
import { ALL_CATEGORIES } from '@/lib/finance';
import { requireUser } from '@/server/auth';
import { getFinanceOverview, parseMonth } from '@/server/finance/queries';

export const metadata = { title: 'Finanzas' };
export const dynamic = 'force-dynamic';

const TABS = ['resumen', 'movimientos', 'presupuestos', 'cuentas', 'importar', 'historial'] as const;
type Search = { tab?: string; month?: string; account?: string; category?: string; q?: string; page?: string };

export default async function FinancePage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const tab = (TABS as readonly string[]).includes(sp.tab ?? '') ? (sp.tab as (typeof TABS)[number]) : 'resumen';
  const category = (ALL_CATEGORIES as readonly string[]).includes(sp.category ?? '') ? sp.category : undefined;
  const page = Math.max(1, Math.min(10_000, Number.parseInt(sp.page ?? '1', 10) || 1));
  const q = sp.q?.trim().slice(0, 80) || undefined;
  const month = parseMonth(sp.month).key;
  const o = await getFinanceOverview(user.id, { month, accountId: sp.account, category, q, page });
  return <FinanceView o={o} tab={tab} params={{ category, q, page, account: sp.account && o.accounts.some((a) => a.id === sp.account) ? sp.account : undefined }} />;
}
