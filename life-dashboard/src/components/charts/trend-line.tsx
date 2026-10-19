'use client';
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatEUR } from '@/lib/utils';
import { makeTooltip } from './tooltip';

export interface LineSeries { key: string; label: string; color: string; area?: boolean }
const compact = (n: number) => (Math.abs(n) >= 1000 ? `${(n / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 })}k` : n.toLocaleString('es-ES', { maximumFractionDigits: 1 }));

/** Línea de 2 px (con eje desde 0 y área tenue por defecto; sin área si el eje no parte de 0, para no exagerar variaciones) con cursor vertical que salta a la fecha más cercana y punto final de 8 px con anillo del color de la superficie. */
export function TrendLine({ data, series, height = 220, ariaLabel, xLabel, zeroBase = true, format = formatEUR }: { data: Record<string, string | number>[]; series: LineSeries[]; height?: number | 'fill'; ariaLabel: string; xLabel?: (v: string) => string; zeroBase?: boolean; format?: (v: number) => string }) {
  const lastIdx = data.length - 1;
  const Tip = makeTooltip(format, { title: (l) => (xLabel ? xLabel(String(l)) : String(l)) });
  return (
    <div style={height === 'fill' ? undefined : { height }} className={height === 'fill' ? 'absolute inset-0' : undefined} role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeWidth={1} />
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: 'var(--chart-axis)' }} tick={{ fontSize: 11, fill: 'var(--chart-muted)' }} minTickGap={32} />
          <YAxis tickLine={false} axisLine={false} width={40} tickFormatter={compact} tick={{ fontSize: 11, fill: 'var(--chart-muted)' }} domain={zeroBase ? [0, 'auto'] : ['auto', 'auto']} />
          <Tooltip content={<Tip />} cursor={{ stroke: 'var(--chart-axis)', strokeWidth: 1 }} />
          {zeroBase && series.filter((s) => s.area).map((s) => <Area key={`a-${s.key}`} dataKey={s.key} stroke="none" fill={s.color} fillOpacity={0.1} isAnimationActive={false} legendType="none" tooltipType="none" />)}
          {series.map((s) => (
            <Line key={s.key} dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" isAnimationActive={false}
              dot={({ cx, cy, index }) => (index === lastIdx ? <circle key={`d-${s.key}`} cx={cx} cy={cy} r={4} fill={s.color} stroke="var(--chart-surface)" strokeWidth={2} /> : <g key={`d-${s.key}-${index}`} />)}
              activeDot={{ r: 4, fill: s.color, stroke: 'var(--chart-surface)', strokeWidth: 2 }} />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
