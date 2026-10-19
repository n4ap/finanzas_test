import { cn } from '@/lib/utils';

export interface BarRow { key: string; label: string; value: number; display: string; note?: string }

/**
 * Barras horizontales ordenadas (una tonalidad): comparar magnitudes entre categorías sin gastar colores.
 * El valor va al final de la barra; la barra nunca supera 12 px de grosor; el nombre/valor viven en tinta de texto.
 */
export function HorizontalBars({ rows, ariaLabel }: { rows: BarRow[]; ariaLabel: string }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="space-y-2.5" aria-label={ariaLabel}>
      {rows.map((r) => (
        <li key={r.key} className="group" title={`${r.label}: ${r.display}${r.note ? ` · ${r.note}` : ''}`}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate">{r.label}</span>
            <span className="shrink-0 font-semibold tabular-nums">{r.display}</span>
          </div>
          <div className="h-3 rounded-r-[4px] bg-transparent">
            <div className="h-3 rounded-r-[4px] transition-opacity group-hover:opacity-80" style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: 'var(--series-1)' }} />
          </div>
          {r.note && <p className="mt-0.5 text-xs text-muted-foreground">{r.note}</p>}
        </li>
      ))}
    </ul>
  );
}

export interface ShareRow { key: string; label: string; value: number; display: string; color: string }

/** Parte-del-todo: una barra apilada con 2 px de hueco entre segmentos y etiquetas directas con porcentaje (sin dona). */
export function ShareBar({ rows, ariaLabel }: { rows: ShareRow[]; ariaLabel: string }) {
  const total = rows.reduce((a, r) => a + r.value, 0) || 1;
  return (
    <div role="img" aria-label={ariaLabel}>
      <div className="flex h-5 gap-0.5 overflow-hidden rounded-[4px]">
        {rows.map((r) => <div key={r.key} title={`${r.label}: ${r.display} (${Math.round((r.value / total) * 100)}%)`} className="h-full transition-opacity hover:opacity-80" style={{ width: `${(r.value / total) * 100}%`, background: r.color }} />)}
      </div>
      <ul className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-2 text-sm">
            <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: r.color }} />
            <span className="truncate">{r.label}</span>
            <span className="ml-auto font-semibold tabular-nums">{Math.round((r.value / total) * 100)}%</span>
            <span className={cn('w-24 text-right text-xs tabular-nums text-muted-foreground')}>{r.display}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Medidor: el relleno avanza acento → aviso → peligro; la pista es un tono más claro de la misma rampa. Con texto, nunca solo color. */
export function Meter({ pct, status, label }: { pct: number; status: 'ok' | 'warn' | 'over'; label: string }) {
  const color = status === 'over' ? 'var(--meter-danger)' : status === 'warn' ? 'var(--meter-warn)' : 'var(--meter-fill)';
  return (
    <div className="h-2 overflow-hidden rounded-full" style={{ background: 'var(--meter-track)' }} role="progressbar" aria-valuenow={Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct * 100)}%`, background: color }} />
    </div>
  );
}
