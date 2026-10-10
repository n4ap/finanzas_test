'use client';
import { Pencil, Plus } from 'lucide-react';
import { useState, useTransition } from 'react';
import { Meter } from '@/components/charts/bars';
import { Dialog } from '@/components/ui/dialog';
import { Badge, Button, EmptyState, Field, Input, Select } from '@/components/ui/primitives';
import { EXPENSE_CATEGORIES, categoryLabel } from '@/lib/finance';
import { formatEUR } from '@/lib/utils';
import { setBudgetAction } from '@/server/actions/finance';
import type { FinanceOverview } from '@/server/finance/queries';
import { monthLabel } from './parts';

export function BudgetsTab({ o }: { o: FinanceOverview }) {
  const [dlg, setDlg] = useState<{ open: boolean; category?: string; monthly?: number }>({ open: false });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const unbudgeted = EXPENSE_CATEGORIES.filter((c) => !o.allBudgets.some((b) => b.category === c.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Gasto de {monthLabel(o.month)} frente a tu límite mensual por categoría. Aviso al 80 %.</p>
        <Button onClick={() => { setError(null); setDlg({ open: true }); }} disabled={unbudgeted.length === 0}><Plus size={16} /> Añadir</Button>
      </div>
      {o.budgets.length === 0 ? <EmptyState title="Sin presupuestos" hint="Define un límite mensual por categoría para ver cuánto te queda y recibir avisos." /> : (
        <ul className="space-y-3">
          {o.budgets.map((b) => (
            <li key={b.category} className="rounded-2xl border bg-card p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-medium">{categoryLabel(b.category)}
                  {b.status === 'over' && <Badge tone="urgent">Superado</Badge>}{b.status === 'warn' && <Badge tone="important">Cerca del límite</Badge>}</p>
                <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Editar presupuesto de ${categoryLabel(b.category)}`} onClick={() => { setError(null); setDlg({ open: true, category: b.category, monthly: b.budget }); }}><Pencil size={14} /></Button>
              </div>
              <Meter pct={b.pct} status={b.status} label={`Presupuesto de ${categoryLabel(b.category)}`} />
              <p className="mt-2 flex justify-between text-xs text-muted-foreground tabular-nums"><span>{formatEUR(b.spent, 2)} de {formatEUR(b.budget)} ({Math.round(b.pct * 100)}%)</span><span>{b.remaining >= 0 ? `Te quedan ${formatEUR(b.remaining, 2)}` : `Te pasas ${formatEUR(-b.remaining, 2)}`}</span></p>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={dlg.open} onClose={() => setDlg({ open: false })} title={dlg.category ? `Presupuesto de ${categoryLabel(dlg.category)}` : 'Nuevo presupuesto'}>
        <form key={dlg.category ?? 'new'} className="space-y-3" onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          start(async () => { const r = await setBudgetAction({ category: dlg.category ?? f.get('category'), monthly: String(f.get('monthly')).replace(',', '.') }); if (r.ok) setDlg({ open: false }); else setError(r.error); });
        }}>
          {!dlg.category && <Field label="Categoría"><Select name="category">{unbudgeted.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select></Field>}
          <Field label="Límite mensual (€) — 0 para eliminarlo"><Input name="monthly" inputMode="decimal" required defaultValue={dlg.monthly ?? ''} autoFocus /></Field>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setDlg({ open: false })}>Cancelar</Button><Button type="submit" disabled={pending}>Guardar</Button></div>
        </form>
      </Dialog>
    </div>
  );
}
