'use client';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatEUR } from '@/lib/utils';
import { makeTooltip } from './tooltip';

export interface ColumnSeries { key: string; label: string; color: string }
const compact = (n: number) => (Math.abs(n) >= 1000 ? `${(n / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 })}k` : n.toLocaleString('es-ES', { maximumFractionDigits: 1 }));

/**
 * Columnas agrupadas (1-4 series) o con signo (`signed`: positivo/negativo con colores divergentes).
 * Marcas: ≤24 px, 4 px redondeado solo en el extremo, 2 px de hueco entre barras, cuadrícula de 1 px,
 * valor directo solo en la última columna.
 */
export function ColumnsChart({ data, series, signed, height = 200, ariaLabel, labelLast, format = formatEUR }: { data: Record<string, string | number>[]; series: ColumnSeries[]; signed?: { pos: string; neg: string }; height?: number | 'fill'; ariaLabel: string; labelLast?: boolean; format?: (v: number) => string }) {
  // Etiqueta directa del último valor solo con una serie: con barras agrupadas los rótulos se pisarían (el tooltip, la leyenda y la tabla llevan el valor).
  const showLast = labelLast ?? series.length === 1;
  const last = data.length - 1;
  const Tip = makeTooltip(format, { colorOf: (e) => (signed ? (Number(e.value) >= 0 ? signed.pos : signed.neg) : String(e.color)) });
  return (
    <div style={height === 'fill' ? undefined : { height }} className={height === 'fill' ? 'absolute inset-0' : undefined} role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 16, right: 4, bottom: 0, left: 0 }} barGap={2} barCategoryGap="30%">
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeWidth={1} />
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: 'var(--chart-axis)' }} tick={{ fontSize: 11, fill: 'var(--chart-muted)' }} />
          <YAxis tickLine={false} axisLine={false} width={36} tickFormatter={compact} tick={{ fontSize: 11, fill: 'var(--chart-muted)' }} />
          <Tooltip content={<Tip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.6 }} />
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} stroke="var(--chart-surface)" strokeWidth={2}>
              {signed && data.map((d, i) => <Cell key={i} fill={Number(d[s.key]) >= 0 ? signed.pos : signed.neg} />)}
              <LabelList dataKey={s.key} position="top" content={({ x, y, width, value, index }) => showLast && index === last ? <text x={Number(x) + Number(width) / 2} y={Number(y) - 4} textAnchor="middle" fontSize={11} fontWeight={600} fill="hsl(var(--foreground))">{format(Number(value))}</text> : null} />
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
