import { Bell, Bot, Dumbbell, LineChart, Plane, Wallet } from 'lucide-react';
import Link from 'next/link';
import { Sparkline } from '@/components/charts';
import { ColumnsChart } from '@/components/charts/columns-chart';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { categoryLabel } from '@/lib/finance';
import { formatEUR } from '@/lib/utils';
import type { DashboardData } from '@/server/dashboard-data';
import { Row, WidgetFrame } from './frame';

const Stat = ({ label, value, tone }: { label: string; value: string; tone?: 'success' | 'danger' }) => (
  <div><p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p><p className={`text-lg font-semibold tabular-nums ${tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : ''}`}>{value}</p></div>
);

export function FinanceWidget({ d }: { d: DashboardData }) {
  const m = d.finance.month;
  const over = d.finance.budgets.filter((b) => b.status === 'over');
  const warn = d.finance.budgets.filter((b) => b.status === 'warn');
  return (
    <WidgetFrame title="Finanzas" icon={Wallet} href="/finance">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Ingresos" value={formatEUR(m.income)} tone="success" />
        <Stat label="Gastos" value={formatEUR(m.expenses)} />
        <Stat label="Ahorro" value={formatEUR(m.saving)} tone={m.saving >= 0 ? 'success' : 'danger'} />
        <Stat label="Patrimonio" value={formatEUR(d.finance.netWorth)} />
      </div>
      {(over.length > 0 || warn.length > 0) && (
        <Link href="/finance?tab=presupuestos" className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
          {over.length > 0 && <Badge tone="urgent">{over.length} presupuesto{over.length > 1 ? 's' : ''} superado{over.length > 1 ? 's' : ''}: {over.map((b) => categoryLabel(b.category)).join(', ')}</Badge>}
          {warn.length > 0 && <Badge tone="important">{warn.length} cerca del límite</Badge>}
        </Link>
      )}
      <ul className="mt-3 flex gap-4 text-xs text-muted-foreground" aria-label="Leyenda"><li className="flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: 'var(--series-1)' }} />Ingresos</li><li className="flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: 'var(--series-2)' }} />Gastos</li></ul>
      <ColumnsChart data={d.finance.series.map((m) => ({ ...m, label: m.month }))} series={[{ key: 'income', label: 'Ingresos', color: 'var(--series-1)' }, { key: 'expenses', label: 'Gastos', color: 'var(--series-2)' }]} height={150} ariaLabel="Ingresos y gastos de los últimos meses" />
    </WidgetFrame>
  );
}

export function InvestmentsWidget({ d }: { d: DashboardData }) {
  const p = d.positions;
  const up = p.pnl >= 0;
  return (
    <WidgetFrame title="Inversiones" icon={LineChart} href="/investments">
      {p.rows.length === 0 ? <EmptyState title="Sin posiciones" /> : (
        <>
          <p className="text-2xl font-semibold tabular-nums">{formatEUR(p.value)}</p>
          <p className={`text-sm ${up ? 'text-success' : 'text-danger'}`}>{up ? '▲' : '▼'} {formatEUR(Math.abs(p.pnl))} ({(p.pnlPct * 100).toFixed(1)}%)</p>
          <div className="mt-2 flex gap-1.5" aria-label="Distribución">
            {p.allocation.map((a) => <Badge key={a.type}>{a.type} {Math.round(a.pct * 100)}%</Badge>)}
          </div>
        </>
      )}
    </WidgetFrame>
  );
}

export function HealthWidget({ d }: { d: DashboardData }) {
  const w = d.health.weight;
  const last = w.at(-1)?.value;
  const delta = last !== undefined && w[0] ? last - w[0].value : 0;
  const weekAgo = new Date(d.now.getTime() - 7 * 86_400_000);
  const done = d.health.workouts.filter((x) => !x.planned && x.date >= weekAgo).length;
  const steps = d.health.steps.at(-1)?.value;
  return (
    <WidgetFrame title="Salud" icon={Dumbbell} href="/health">
      {last === undefined ? <EmptyState title="Sin datos de salud" /> : (
        <>
          <div className="flex items-end justify-between"><div><p className="text-2xl font-semibold tabular-nums">{last.toFixed(1)} kg</p><p className={`text-xs ${delta <= 0 ? 'text-success' : 'text-warning'}`}>{delta > 0 ? '+' : ''}{delta.toFixed(1)} kg en 30 días</p></div>
            <div className="w-24"><Sparkline data={w} color="#10b981" /></div></div>
          <div className="mt-2 flex gap-2"><Badge tone="primary">{done} entrenos / 7 días</Badge>{steps !== undefined && <Badge>{Math.round(steps).toLocaleString('es-ES')} pasos</Badge>}</div>
        </>
      )}
    </WidgetFrame>
  );
}

export function TravelWidget({ d }: { d: DashboardData }) {
  const t = d.trips[0];
  const days = t ? Math.ceil((t.startDate.getTime() - d.now.getTime()) / 86_400_000) : 0;
  return (
    <WidgetFrame title="Viajes" icon={Plane} href="/travel">
      {!t ? <EmptyState title="Sin viajes próximos" /> : (
        <Link href={`/travel/${t.id}`} className="block rounded-xl bg-muted/60 p-3 hover:bg-muted">
          <p className="font-medium">{t.name}</p><p className="text-xs text-muted-foreground">{t.destination}</p>
          <p className="mt-2 text-sm"><span className="text-xl font-semibold tabular-nums">{Math.max(days, 0)}</span> días para salir</p>
        </Link>
      )}
    </WidgetFrame>
  );
}

export function NotificationsWidget({ d }: { d: DashboardData }) {
  return (
    <WidgetFrame title="Notificaciones" icon={Bell}>
      {d.notifications.length === 0 ? <EmptyState title="Todo al día" /> : (
        <ul className="divide-y">{d.notifications.slice(0, 4).map((n) => <Row key={n.id} left={<span className={n.read ? '' : 'font-medium'}>{n.title}</span>} sub={n.body} />)}</ul>
      )}
    </WidgetFrame>
  );
}

export function AIWidget() {
  const suggestions = ['¿Qué tengo mañana?', '¿Cuánto he gastado este mes?', 'Organízame la semana'];
  return (
    <WidgetFrame title="Asistente IA" icon={Bot} href="/assistant">
      <ul className="space-y-1.5">
        {suggestions.map((s) => <li key={s}><Link href={`/assistant?q=${encodeURIComponent(s)}`} className="block rounded-lg border px-3 py-2 text-sm hover:bg-muted">{s}</Link></li>)}
      </ul>
    </WidgetFrame>
  );
}
