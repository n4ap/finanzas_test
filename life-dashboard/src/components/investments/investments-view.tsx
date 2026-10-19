'use client';
import { Plus, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useRun } from '@/components/ui/use-run';
import { refreshPricesAction } from '@/server/actions/finance';
import type { RefreshResult } from '@/server/finance/quotes';
import { ShareBar } from '@/components/charts/bars';
import { ChartCard } from '@/components/charts/chart-card';
import { ColumnsChart } from '@/components/charts/columns-chart';
import { TrendLine } from '@/components/charts/trend-line';
import { StatTile } from '@/components/finance/parts';
import { Badge, Button, EmptyState } from '@/components/ui/primitives';
import { ASSET_TYPES, assetLabel } from '@/lib/finance';
import { cn, formatEUR } from '@/lib/utils';
import type { InvestmentsOverview } from '@/server/finance/queries';
import { DividendForm, PositionForm, type PositionDTO } from './forms';

// Color fijo por tipo de activo (sigue a la entidad, nunca a su posición en el ranking).
const TYPE_COLOR: Record<string, string> = Object.fromEntries(ASSET_TYPES.map((a, i) => [a.id, `var(--series-${i + 1})`]));
const pct = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n * 100).toFixed(1).replace('.', ',')}%`;
const signed = (n: number) => `${n >= 0 ? '+' : '−'}${formatEUR(Math.abs(n))}`;
// Con el año abreviado: la serie abarca 12 meses y «6 oct» sería ambiguo.
const dayLabel = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'UTC' }).replace(/\./g, '');

function summary(r?: RefreshResult) {
  if (!r) return null;
  const ok = r.updated.length;
  const bad = r.failed.length ? ` · Sin precio: ${r.failed.map((f) => `${f.symbol} (${f.reason})`).join('; ')}` : '';
  return `${ok} ${ok === 1 ? 'posición actualizada' : 'posiciones actualizadas'}${bad}`;
}

export function InvestmentsView({ o }: { o: InvestmentsOverview }) {
  const [pos, setPos] = useState<{ open: boolean; position?: PositionDTO | null }>({ open: false });
  const [div, setDiv] = useState(false);
  const quotes = useRun();
  const [note, setNote] = useState<string | null>(null);
  const refresh = () => quotes.run(refreshPricesAction, (r) => setNote(summary(r)));
  const { totals: t } = o;
  const up = t.pnl >= 0;
  const evolution = o.evolution.map((e) => ({ ...e, label: dayLabel(e.date) }));
  const divData = o.dividendsByMonth.map((d) => ({ label: d.month, amount: d.amount }));
  const positionDTOs: PositionDTO[] = o.positions;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold">Inversiones</h1>
        <Button variant="outline" onClick={refresh} disabled={quotes.pending || o.positions.length === 0}><RefreshCw size={16} className={quotes.pending ? 'animate-spin' : undefined} aria-hidden /> {quotes.pending ? 'Actualizando…' : 'Actualizar precios'}</Button>
        <Button variant="outline" onClick={() => setDiv(true)} disabled={o.positions.length === 0}>Registrar dividendo</Button>
        <Button onClick={() => setPos({ open: true })}><Plus size={16} /> Nueva posición</Button>
      </div>
      {quotes.error && <p role="alert" className="text-sm text-danger">{quotes.error}</p>}
      {note && !quotes.error && <p role="status" className="text-sm text-muted-foreground">{note}</p>}

      {o.positions.length === 0 ? <EmptyState title="Sin posiciones" hint="Añade tus acciones, ETFs, fondos o criptomonedas para ver rentabilidad, distribución y dividendos." /> : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Patrimonio invertido" value={formatEUR(t.value)} />
            <StatTile label="Aportado (coste)" value={formatEUR(t.cost)} />
            <div className="rounded-2xl border bg-card p-4"><p className="text-xs text-muted-foreground">Rentabilidad</p><p className="mt-1 text-2xl font-semibold tabular-nums">{signed(t.pnl)}</p><p className={cn('mt-1 text-xs', up ? 'text-success' : 'text-danger')}>{up ? '▲' : '▼'} {pct(t.pnlPct)} sobre lo aportado</p></div>
            <StatTile label="Dividendos" value={formatEUR(o.dividendsReceived12, 2)} hint={`cobrados 12 m · estimado ${formatEUR(t.annualDividends)}/año`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Evolución de la cartera" subtitle="Valor frente a lo aportado" legend={[{ label: 'Valor', color: 'var(--series-1)', kind: 'line' }, { label: 'Aportado', color: 'var(--series-2)', kind: 'line' }]}
              table={{ columns: ['Fecha', 'Valor', 'Aportado'], rows: o.evolution.map((e) => [dayLabel(e.date), formatEUR(e.value), formatEUR(e.cost)]) }}>
              {evolution.length >= 2 ? <TrendLine zeroBase={false} data={evolution} series={[{ key: 'value', label: 'Valor', color: 'var(--series-1)' }, { key: 'cost', label: 'Aportado', color: 'var(--series-2)' }]} ariaLabel="Evolución del valor de la cartera" /> : <EmptyState title="Historial en construcción" hint="Se guarda una instantánea cada día que actualizas precios o posiciones." />}
            </ChartCard>
            <ChartCard title="Distribución por tipo de activo" subtitle={formatEUR(t.value)} table={{ columns: ['Tipo', 'Valor', 'Peso'], rows: o.allocation.map((a) => [assetLabel(a.type), formatEUR(a.value), `${Math.round(a.pct * 100)}%`]) }}>
              <ShareBar ariaLabel="Distribución de la cartera" rows={o.allocation.map((a) => ({ key: a.type, label: assetLabel(a.type), value: a.value, display: formatEUR(a.value), color: TYPE_COLOR[a.type] ?? 'var(--series-1)' }))} />
            </ChartCard>
          </div>

          <section aria-label="Posiciones" className="overflow-hidden rounded-2xl border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left text-xs text-muted-foreground"><tr>{['Posición', 'Cantidad', 'Coste medio', 'Precio', 'Valor', 'Rentabilidad', 'Peso'].map((h, i) => <th key={h} scope="col" className={cn('whitespace-nowrap p-3 font-medium', i > 0 && 'text-right')}>{h}</th>)}</tr></thead>
                <tbody>
                  {o.positions.map((p) => (
                    <tr key={p.id} className="cursor-pointer border-t hover:bg-muted/40" onClick={() => setPos({ open: true, position: p })}>
                      <td className="p-3"><button className="text-left font-medium hover:text-primary" onClick={(e) => { e.stopPropagation(); setPos({ open: true, position: p }); }} aria-label={`Editar ${p.symbol}`}>{p.symbol}</button><div className="flex items-center gap-1.5 text-xs text-muted-foreground"><span aria-hidden className="h-2 w-2 rounded-sm" style={{ background: TYPE_COLOR[p.assetType] }} />{p.name}</div></td>
                      <td className="p-3 text-right tabular-nums">{p.quantity.toLocaleString('es-ES', { maximumFractionDigits: 8 })}</td>
                      <td className="p-3 text-right tabular-nums">{formatEUR(p.avgCost, 2)}</td>
                      <td className="p-3 text-right tabular-nums">{formatEUR(p.currentPrice, 2)}</td>
                      <td className="p-3 text-right font-semibold tabular-nums">{formatEUR(p.value)}</td>
                      <td className={cn('p-3 text-right tabular-nums', p.pnl >= 0 ? 'text-success' : 'text-danger')}>{p.pnl >= 0 ? '▲' : '▼'} {signed(p.pnl)} <span className="text-xs">({pct(p.pnlPct)})</span></td>
                      <td className="p-3 text-right tabular-nums text-muted-foreground">{Math.round(p.weight * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Dividendos cobrados" subtitle="Últimos 12 meses" table={{ columns: ['Mes', 'Dividendos'], rows: o.dividendsByMonth.map((d) => [d.month, formatEUR(d.amount, 2)]) }}>
              {o.dividendsReceived12 > 0 ? <ColumnsChart data={divData} series={[{ key: 'amount', label: 'Dividendos', color: 'var(--series-1)' }]} ariaLabel="Dividendos cobrados por mes" height={180} /> : <EmptyState title="Aún no has registrado dividendos" />}
            </ChartCard>
            <section aria-label="Últimos dividendos" className="rounded-2xl border bg-card p-4">
              <h3 className="mb-2 text-sm font-semibold">Últimos dividendos</h3>
              {o.dividendList.length === 0 ? <EmptyState title="Sin dividendos registrados" /> : (
                <ul className="divide-y">{o.dividendList.slice(0, 6).map((d) => <li key={d.id} className="flex items-center justify-between py-2 text-sm"><span><Badge>{d.symbol}</Badge> <span className="ml-2 text-xs text-muted-foreground">{dayLabel(d.date)}</span></span><span className="tabular-nums">{formatEUR(d.amount, 2)}</span></li>)}</ul>
              )}
            </section>
          </div>
        </>
      )}
      <PositionForm open={pos.open} onClose={() => setPos({ open: false })} position={pos.position} />
      <DividendForm open={div} onClose={() => setDiv(false)} positions={positionDTOs} />
    </div>
  );
}
