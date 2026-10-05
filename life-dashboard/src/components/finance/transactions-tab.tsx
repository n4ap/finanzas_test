'use client';
import { ChevronLeft, ChevronRight, Download, Plus, Repeat, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge, Button, EmptyState, Input, Select } from '@/components/ui/primitives';
import { ALL_CATEGORIES, categoryLabel } from '@/lib/finance';
import { cn, formatEUR } from '@/lib/utils';
import type { FinanceOverview } from '@/server/finance/queries';
import { TransactionForm } from './transaction-form';
import { fmtDay } from './parts';
import type { TxDTO } from './types';

export function TransactionsTab({ o, params, setParams }: { o: FinanceOverview; params: { category?: string; q?: string; page: number; account?: string }; setParams: (u: Record<string, string | null>) => void }) {
  const [form, setForm] = useState<{ open: boolean; tx?: TxDTO | null }>({ open: false });
  const [q, setQ] = useState(params.q ?? '');
  const { items, total, pageSize } = o.transactions;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const accName = new Map(o.accounts.map((a) => [a.id, a]));

  // Búsqueda con retardo para no recargar en cada tecla.
  useEffect(() => { const t = setTimeout(() => { if ((params.q ?? '') !== q.trim()) setParams({ q: q.trim() || null, page: null }); }, 350); return () => clearTimeout(t); }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1 sm:max-w-xs"><Search size={14} className="absolute left-3 top-3 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar concepto o comercio…" className="pl-8" aria-label="Buscar movimientos" /></div>
        <Select value={params.category ?? ''} onChange={(e) => setParams({ category: e.target.value || null, page: null })} className="w-auto" aria-label="Filtrar por categoría">
          <option value="">Todas las categorías</option>{ALL_CATEGORIES.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}
        </Select>
        <a href={`/api/finance/export?month=${o.month}`} className="inline-flex h-10 items-center gap-2 rounded-xl border bg-card px-3 text-sm hover:bg-muted"><Download size={14} /> Exportar CSV</a>
        <Button className="ml-auto" onClick={() => setForm({ open: true })} disabled={o.accounts.length === 0}><Plus size={16} /> Nuevo movimiento</Button>
      </div>

      {items.length === 0 ? <EmptyState title="No hay movimientos con estos filtros" hint={o.accounts.length === 0 ? 'Crea primero una cuenta en la pestaña Cuentas.' : 'Prueba otro mes o limpia la búsqueda.'} /> : (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card" aria-label="Movimientos">
          {items.map((t) => {
            const acc = accName.get(t.accountId);
            return (
              <li key={t.id}>
                <button onClick={() => setForm({ open: true, tx: t })} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50">
                  <span className="w-12 shrink-0 text-xs text-muted-foreground">{fmtDay(t.date)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium">{t.description}
                      {t.recurring && <Badge tone="primary"><Repeat size={10} />recurrente</Badge>}
                      {t.upcoming && <Badge tone="important">previsto</Badge>}
                      {t.source === 'csv' && <Badge>CSV</Badge>}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{categoryLabel(t.category)}{o.accounts.length > 1 && acc ? ` · ${acc.name}` : ''}{acc?.shared ? ` · ${t.by}` : ''}{t.merchant ? ` · ${t.merchant}` : ''}</span>
                  </span>
                  <span className={cn('shrink-0 text-sm font-semibold tabular-nums', t.amount > 0 && 'text-success')}>{t.amount > 0 ? '+' : '−'}{formatEUR(Math.abs(t.amount), 2)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{total} movimiento{total === 1 ? '' : 's'}</span>
        {pages > 1 && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" disabled={params.page <= 1} onClick={() => setParams({ page: String(params.page - 1) })} aria-label="Página anterior"><ChevronLeft size={16} /></Button>
            <span>Página {params.page} de {pages}</span>
            <Button variant="outline" size="icon" disabled={params.page >= pages} onClick={() => setParams({ page: String(params.page + 1) })} aria-label="Página siguiente"><ChevronRight size={16} /></Button>
          </div>
        )}
      </div>
      <TransactionForm open={form.open} onClose={() => setForm({ open: false })} tx={form.tx} accounts={o.accounts} defaultAccountId={params.account} />
    </div>
  );
}
