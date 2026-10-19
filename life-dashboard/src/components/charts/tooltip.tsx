/** Tooltip de Recharts: el valor manda (negrita, tinta principal), el nombre es secundario; clave de serie = trazo corto, no caja. */
interface Entry { name?: string | number; value?: number | string; color?: string; dataKey?: string | number; payload?: Record<string, unknown> }
export interface TipProps { active?: boolean; payload?: Entry[]; label?: string | number }

export function makeTooltip(format: (v: number) => string, opts: { title?: (label: string | number | undefined, p?: Record<string, unknown>) => string; colorOf?: (e: Entry) => string } = {}) {
  return function ChartTooltip({ active, payload, label }: TipProps) {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-xl border bg-card px-3 py-2 text-xs shadow-lg" role="status">
        <p className="mb-1 text-muted-foreground">{opts.title ? opts.title(label, payload[0]?.payload) : label}</p>
        <ul className="space-y-0.5">
          {payload.map((e, i) => (
            <li key={i} className="flex items-center gap-2">
              <span aria-hidden className="h-0.5 w-3 rounded" style={{ background: opts.colorOf ? opts.colorOf(e) : e.color }} />
              <span className="text-sm font-semibold tabular-nums">{format(Number(e.value))}</span>
              <span className="text-muted-foreground">{e.name}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  };
}
