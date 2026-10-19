'use client';
import { Table2 } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface LegendItem { label: string; color: string; kind?: 'rect' | 'line' }
export interface TableData { columns: string[]; rows: (string | number)[][] }

/** Contenedor de gráfico: título, leyenda (siempre con ≥2 series), y vista de tabla como alternativa accesible. */
export function ChartCard({ title, subtitle, legend, table, children, className, fill }: { title: string; subtitle?: string; legend?: LegendItem[]; table: TableData; children: ReactNode; className?: string; fill?: boolean }) {
  const [asTable, setAsTable] = useState(false);
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn('flex flex-col rounded-2xl border bg-card p-4', className)}>
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={id} className="text-sm font-semibold">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <button onClick={() => setAsTable((v) => !v)} aria-pressed={asTable} className={cn('flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-xs text-muted-foreground hover:bg-muted', asTable && 'bg-muted text-foreground')}>
          <Table2 size={12} /> {asTable ? 'Ver gráfico' : 'Ver tabla'}
        </button>
      </header>
      {legend && legend.length > 1 && !asTable && (
        <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Leyenda">
          {legend.map((l) => (
            <li key={l.label} className="flex items-center gap-1.5">
              <span aria-hidden className={l.kind === 'line' ? 'h-0.5 w-3.5 rounded' : 'h-2.5 w-2.5 rounded-sm'} style={{ background: l.color }} /> {l.label}
            </li>
          ))}
        </ul>
      )}
      {asTable ? (
        <div className="max-h-72 overflow-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-xs text-muted-foreground">{table.columns.map((c, i) => <th key={c} scope="col" className={cn('py-1.5 font-medium', i > 0 && 'text-right')}>{c}</th>)}</tr></thead>
            <tbody>{table.rows.map((r, i) => <tr key={i} className="border-b last:border-0">{r.map((v, j) => <td key={j} className={cn('py-1.5', j > 0 && 'text-right tabular-nums')}>{v}</td>)}</tr>)}</tbody>
          </table>
        </div>
      ) : fill ? <div className="relative min-h-52 flex-1">{children}</div> : children}
    </section>
  );
}
