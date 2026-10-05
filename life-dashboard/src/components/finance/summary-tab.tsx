'use client';
import { CalendarClock } from 'lucide-react';
import { ChartCard } from '@/components/charts/chart-card';
import { HorizontalBars, Meter } from '@/components/charts/bars';
import { ColumnsChart } from '@/components/charts/columns-chart';
import { TrendLine } from '@/components/charts/trend-line';
import { EmptyState } from '@/components/ui/primitives';
import { categoryLabel } from '@/lib/finance';
import { formatEUR } from '@/lib/utils';
import type { FinanceOverview } from '@/server/finance/queries';
import { StatTile, fmtDay, monthLabel } from './parts';

export function SummaryTab({ o }: { o: FinanceOverview }) {
  const { summary: s, prev } = o;
  const totalBudget = o.budgets.reduce((a, b) => a + b.budget, 0);
  const budgetedSpent = o.budgets.reduce((a, b) => a + b.spent, 0);
  const budgetPct = totalBudget > 0 ? budgetedSpent / totalBudget : 0;
  const hasData = s.income > 0 || s.expenses > 0 || o.series.some((m) => m.income || m.expenses);
  const budgetByCat = new Map(o.budgets.map((b) => [b.category, b]));
  const catRows = s.byCategory.map((c) => {
    const b = budgetByCat.get(c.category);
    return { key: c.category, label: categoryLabel(c.category), value: c.amount, display: formatEUR(c.amount, 2), note: b ? (b.status === 'over' ? `Superado: presupuesto ${formatEUR(b.budget)}` : `De ${formatEUR(b.budget)} · te quedan ${formatEUR(b.remaining)}`) : `${Math.round((c.amount / (s.expenses || 1)) * 100)}% del gasto` };
  });
  const partial = o.series.some((m) => m.partial);
  const dLabel = prev.samePeriod ? 'vs mismo punto del mes anterior' : 'vs mes anterior';
  const chartData = o.series.map((m) => ({ label: m.partial ? `${m.month}*` : m.month, income: m.income, expenses: m.expenses, saving: m.saving }));
  const monthsNote = partial ? 'Últimos 6 meses · * mes en curso (incompleto)' : 'Últimos 6 meses';
  const tableMonth = (m: { month: string; partial: boolean }) => (m.partial ? `${m.month} (en curso)` : m.month);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile label="Ingresos" value={formatEUR(s.income)} delta={s.income - prev.income} deltaLabel={dLabel} />
        <StatTile label="Gastos" value={formatEUR(s.expenses)} delta={s.expenses - prev.expenses} deltaLabel={dLabel} upIsGood={false} />
        <StatTile label="Ahorro" value={formatEUR(s.saving)} delta={s.saving - prev.saving} deltaLabel={dLabel} hint={s.income > 0 ? `${Math.round(s.savingRate * 100)}% de los ingresos` : undefined} />
        <StatTile label="Saldo en cuentas" value={formatEUR(o.cash)} hint={`${o.accounts.filter((a) => o.scopeIds.includes(a.id)).length} cuenta(s)`} />
        <StatTile label="Patrimonio" value={formatEUR(o.netWorth)} hint={`Incluye ${formatEUR(o.invested)} invertidos`} />
      </div>

      {totalBudget > 0 && (
        <div className="rounded-2xl border bg-card p-4">
          <div className="mb-2 flex items-baseline justify-between text-sm"><span className="font-medium">Presupuesto de {monthLabel(o.month)}</span><span className="tabular-nums text-muted-foreground">{formatEUR(budgetedSpent)} de {formatEUR(totalBudget)} ({Math.round(budgetPct * 100)}%)</span></div>
          <Meter pct={budgetPct} status={budgetPct >= 1 ? 'over' : budgetPct >= 0.8 ? 'warn' : 'ok'} label="Presupuesto total del mes" />
        </div>
      )}

      {!hasData ? <EmptyState title="Aún no hay movimientos" hint="Añade tu primer movimiento o importa un CSV desde la pestaña Importar." /> : (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Gastos por categoría" subtitle={`${monthLabel(o.month)} · ${formatEUR(s.expenses)}`} table={{ columns: ['Categoría', 'Gasto'], rows: s.byCategory.map((c) => [categoryLabel(c.category), formatEUR(c.amount, 2)]) }}>
            {catRows.length ? <HorizontalBars rows={catRows} ariaLabel="Gasto por categoría" /> : <EmptyState title="Sin gastos este mes" />}
          </ChartCard>
          <ChartCard fill title="Ingresos vs gastos" subtitle={monthsNote} legend={[{ label: 'Ingresos', color: 'var(--series-1)' }, { label: 'Gastos', color: 'var(--series-2)' }]}
            table={{ columns: ['Mes', 'Ingresos', 'Gastos'], rows: o.series.map((m) => [tableMonth(m), formatEUR(m.income), formatEUR(m.expenses)]) }}>
            <ColumnsChart height="fill" data={chartData} series={[{ key: 'income', label: 'Ingresos', color: 'var(--series-1)' }, { key: 'expenses', label: 'Gastos', color: 'var(--series-2)' }]} ariaLabel="Ingresos y gastos mensuales" />
          </ChartCard>
          <ChartCard title="Evolución mensual de gastos" subtitle={monthsNote} table={{ columns: ['Mes', 'Gastos'], rows: o.series.map((m) => [tableMonth(m), formatEUR(m.expenses)]) }}>
            <TrendLine data={chartData} series={[{ key: 'expenses', label: 'Gastos', color: 'var(--series-2)', area: true }]} ariaLabel="Evolución de los gastos mensuales" />
          </ChartCard>
          <ChartCard title="Ahorro mensual" subtitle={`Ingresos − gastos · azul ahorro, rojo déficit${partial ? ' · * mes en curso' : ''}`} legend={[{ label: 'Ahorro', color: 'var(--div-pos)' }, { label: 'Déficit', color: 'var(--div-neg)' }]}
            table={{ columns: ['Mes', 'Ahorro'], rows: o.series.map((m) => [tableMonth(m), `${m.saving >= 0 ? '' : '−'}${formatEUR(Math.abs(m.saving))} ${m.saving >= 0 ? '(ahorro)' : '(déficit)'}`]) }}>
            <ColumnsChart data={chartData} series={[{ key: 'saving', label: 'Ahorro', color: 'var(--div-pos)' }]} signed={{ pos: 'var(--div-pos)', neg: 'var(--div-neg)' }} ariaLabel="Ahorro mensual" />
          </ChartCard>
        </div>
      )}

      {o.upcoming.length > 0 && (
        <section aria-label="Pagos próximos" className="rounded-2xl border bg-card p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><CalendarClock size={15} className="text-muted-foreground" /> Pagos próximos</h3>
          <ul className="divide-y">{o.upcoming.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-3 py-2 text-sm"><span className="truncate">{u.description}<span className="ml-2 text-xs text-muted-foreground">{categoryLabel(u.category)}</span></span><span className="shrink-0 tabular-nums"><span className="mr-3 text-xs text-muted-foreground">{fmtDay(u.date)}</span>{formatEUR(Math.abs(u.amount), 2)}</span></li>
          ))}</ul>
        </section>
      )}
    </div>
  );
}
