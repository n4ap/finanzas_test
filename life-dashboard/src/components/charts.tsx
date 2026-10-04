'use client';
import { Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';

export const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#0ea5e9', '#ec4899', '#64748b', '#8b5cf6', '#14b8a6'];

export function Sparkline({ data, color = '#6366f1', height = 56 }: { data: { value: number }[]; color?: string; height?: number }) {
  return (
    <div style={{ height }} aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <defs><linearGradient id={`g${color.slice(1)}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.35} /><stop offset="100%" stopColor={color} stopOpacity={0} /></linearGradient></defs>
          <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#g${color.slice(1)})`} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function IncomeExpenseBars({ data, height = 140 }: { data: { month: string; income: number; expenses: number }[]; height?: number }) {
  return (
    <div style={{ height }} role="img" aria-label="Ingresos y gastos de los últimos meses">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} barGap={2}>
          <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
          <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: 12 }} formatter={(v) => `${Number(v).toLocaleString('es-ES')} €`} />
          <Bar dataKey="income" name="Ingresos" fill="#10b981" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="expenses" name="Gastos" fill="#6366f1" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Donut({ data, size = 120 }: { data: { name: string; value: number }[]; size?: number }) {
  return (
    <div style={{ width: size, height: size }} role="img" aria-label="Distribución">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="100%" paddingAngle={2} stroke="none" isAnimationActive={false}>
            {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
