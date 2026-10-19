import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn, formatEUR } from '@/lib/utils';

/**
 * Tile de KPI: etiqueta · valor · variación frente al mes anterior.
 * `upIsGood` decide el color de la variación; el signo y la flecha acompañan siempre (el color nunca va solo).
 */
export function StatTile({ label, value, delta, deltaLabel = 'vs mes anterior', upIsGood = true, hint, children }: { label: string; value: string; delta?: number | null; deltaLabel?: string; upIsGood?: boolean; hint?: string; children?: ReactNode }) {
  const dir = delta == null || Math.abs(delta) < 0.5 ? 0 : delta > 0 ? 1 : -1;
  const good = dir === 0 ? null : (dir > 0) === upIsGood;
  const Icon = dir === 0 ? Minus : dir > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {delta != null && (
        <div className="mt-1 text-xs">
          <p className={cn('flex items-center gap-1 font-medium', good === null ? 'text-muted-foreground' : good ? 'text-success' : 'text-danger')}>
            <Icon size={13} className="shrink-0" aria-hidden /> {dir > 0 ? '+' : dir < 0 ? '−' : ''}{formatEUR(Math.abs(delta))}
          </p>
          <p className="text-muted-foreground">{deltaLabel}</p>
        </div>
      )}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      {children}
    </div>
  );
}

export const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number) as [number, number];
  const s = new Date(y, m - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};
export const shiftMonth = (key: string, n: number) => {
  const [y, m] = key.split('-').map(Number) as [number, number];
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
export const fmtDay = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' });
