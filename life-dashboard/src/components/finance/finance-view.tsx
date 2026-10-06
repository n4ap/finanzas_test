'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useTransition } from 'react';
import { Button, Select } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import type { FinanceOverview } from '@/server/finance/queries';
import { AccountsTab } from './accounts-tab';
import { AuditTab } from './audit-tab';
import { BudgetsTab } from './budgets-tab';
import { ImportTab } from './import-tab';
import { monthLabel, shiftMonth } from './parts';
import { SummaryTab } from './summary-tab';
import { TransactionsTab } from './transactions-tab';

const TABS = [
  { id: 'resumen', label: 'Resumen' }, { id: 'movimientos', label: 'Movimientos' }, { id: 'presupuestos', label: 'Presupuestos' },
  { id: 'cuentas', label: 'Cuentas' }, { id: 'importar', label: 'Importar' }, { id: 'historial', label: 'Historial' },
] as const;
type TabId = (typeof TABS)[number]['id'];

export function FinanceView({ o, tab, params }: { o: FinanceOverview; tab: TabId; params: { category?: string; q?: string; page: number; account?: string } }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [loading, start] = useTransition();

  /** Actualiza la URL (única fuente de verdad de filtros); el servidor vuelve a cargar los datos. */
  const setParams = useCallback((updates: Record<string, string | null>) => {
    const next = new URLSearchParams(search.toString());
    for (const [k, v] of Object.entries(updates)) { if (v === null || v === '') next.delete(k); else next.set(k, v); }
    start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }, [router, pathname, search]);

  const showScope = tab !== 'cuentas' && tab !== 'importar' && tab !== 'historial';
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold">Finanzas</h1>
        {showScope && (
          <>
            <Select value={params.account ?? ''} onChange={(e) => setParams({ account: e.target.value || null, page: null })} className="w-auto" aria-label="Cuenta">
              <option value="">Todas las cuentas</option>{o.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={() => setParams({ month: shiftMonth(o.month, -1), page: null })} aria-label="Mes anterior"><ChevronLeft size={16} /></Button>
              <span className="min-w-36 text-center text-sm font-medium" aria-live="polite">{monthLabel(o.month)}</span>
              <Button variant="outline" size="icon" onClick={() => setParams({ month: shiftMonth(o.month, 1), page: null })} aria-label="Mes siguiente"><ChevronRight size={16} /></Button>
            </div>
          </>
        )}
      </div>

      <div role="tablist" aria-label="Secciones de finanzas" className="flex gap-1 overflow-x-auto border-b">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setParams({ tab: t.id === 'resumen' ? null : t.id, page: null })}
            className={cn('-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm', tab === t.id ? 'border-primary font-medium text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>{t.label}</button>
        ))}
      </div>

      <div className={cn('transition-opacity', loading && 'opacity-60')} aria-busy={loading}>
        {tab === 'resumen' && <SummaryTab o={o} />}
        {tab === 'movimientos' && <TransactionsTab o={o} params={params} setParams={setParams} onImport={() => setParams({ tab: 'importar', page: null })} />}
        {tab === 'presupuestos' && <BudgetsTab o={o} />}
        {tab === 'cuentas' && <AccountsTab o={o} />}
        {tab === 'importar' && <ImportTab accounts={o.accounts} defaultAccountId={params.account} onView={(month) => setParams({ tab: 'movimientos', month, page: null, category: null, q: null })} />}
        {tab === 'historial' && <AuditTab o={o} />}
      </div>
    </div>
  );
}
