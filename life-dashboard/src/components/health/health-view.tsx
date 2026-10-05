'use client';
import { Check, Dumbbell, Moon, Plus, Scale, Target, Trash2, Footprints } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Meter } from '@/components/charts/bars';
import { ChartCard } from '@/components/charts/chart-card';
import { ColumnsChart } from '@/components/charts/columns-chart';
import { TrendLine } from '@/components/charts/trend-line';
import { Badge, Button, Card, EmptyState, Segmented } from '@/components/ui/primitives';
import { useRun } from '@/components/ui/use-run';
import { METRIC_META, WORKOUT_LABEL, type MetricKind, type WorkoutKind } from '@/lib/health';
import { cn, formatNumber } from '@/lib/utils';
import { completeWorkoutAction, deleteMetricAction } from '@/server/actions/health';
import type { HealthData } from '@/server/life/queries';
import { GoalsForm, MetricForm, WorkoutForm, type WorkoutDTO } from './forms';

type Tab = 'summary' | 'workouts' | 'log';
const es = formatNumber;
const dayLabel = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' }).replace(/\./g, '');
const when = (iso: string) => new Date(iso).toLocaleString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function Tile({ icon, label, value, unit, sub, pct }: { icon: ReactNode; label: string; value: string; unit?: string; sub?: string; pct?: number | null }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><span aria-hidden className="shrink-0">{icon}</span>{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}{unit && <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>}</p>
      {pct != null && <div className="mt-2"><Meter pct={Math.min(1, pct)} status="ok" label={`${label}: ${Math.round(pct * 100)} % de la meta`} /></div>}
      {sub && <p className="mt-1.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function HealthView({ d }: { d: HealthData }) {
  const [tab, setTab] = useState<Tab>('summary');
  const [metric, setMetric] = useState(false);
  const [goals, setGoals] = useState(false);
  const [wk, setWk] = useState<{ open: boolean; workout?: WorkoutDTO | null }>({ open: false });
  const s = d.summary;
  const empty = d.metrics.length === 0 && d.workouts.length === 0;
  const signed = (n: number, unit: string) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${es(Math.abs(n), 1)} ${unit}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold">Salud y deporte</h1>
        <Segmented label="Sección" value={tab} onChange={setTab} options={[{ value: 'summary', label: 'Resumen' }, { value: 'workouts', label: 'Entrenos' }, { value: 'log', label: 'Registro' }]} />
        <Button variant="outline" onClick={() => setGoals(true)}><Target size={16} /> Metas</Button>
        <Button variant="outline" onClick={() => setMetric(true)}><Plus size={16} /> Medición</Button>
        <Button onClick={() => setWk({ open: true })}><Plus size={16} /> Entreno</Button>
      </div>
      <p className="text-xs text-muted-foreground">Datos introducidos por ti y guardados solo en tu cuenta. No se conectan relojes ni apps de salud todavía, y nada de esto es consejo médico.</p>

      {empty && <Card className="p-6"><EmptyState icon={<Dumbbell size={28} />} title="Aún no hay datos de salud" hint="Registra tu peso, pasos o sueño, o añade un entreno." /></Card>}

      {!empty && tab === 'summary' && (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Tile icon={<Scale size={13} />} label="Peso" value={s.weight.last === null ? '—' : es(s.weight.last, 1)} unit="kg"
              sub={[s.weight.change30 !== null ? `${signed(s.weight.change30, 'kg')} en 30 días` : 'Sin datos suficientes', s.weight.toGoal !== null ? `${s.weight.toGoal === 0 ? 'Meta alcanzada' : `${es(Math.abs(s.weight.toGoal), 1)} kg ${s.weight.toGoal > 0 ? 'sobre' : 'bajo'} tu meta`}` : null].filter(Boolean).join(' · ')} />
            <Tile icon={<Footprints size={13} />} label="Pasos (media 7 días)" value={s.steps.avg7 === null ? '—' : es(s.steps.avg7)} sub={s.steps.avg7 === null ? 'Sin datos esta semana' : `Meta ${es(d.goals.steps!)} · ${Math.round(s.steps.pct! * 100)} % (${s.steps.days} días con dato)`} pct={s.steps.pct} />
            <Tile icon={<Moon size={13} />} label="Sueño (media 7 días)" value={s.sleep.avg7 === null ? '—' : es(s.sleep.avg7, 1)} unit="h" sub={s.sleep.avg7 === null ? 'Sin datos esta semana' : `Meta ${es(d.goals.sleep!, 1)} h · ${Math.round(s.sleep.pct! * 100)} %`} pct={s.sleep.pct} />
            <Tile icon={<Dumbbell size={13} />} label="Entrenos esta semana" value={`${s.workouts.thisWeek}/${s.workouts.target}`} sub={`${s.workouts.minutesWeek} min${s.workouts.streak >= 1 ? ` · racha de ${s.workouts.streak} ${s.workouts.streak === 1 ? 'semana' : 'semanas'}` : ''}`} pct={s.workouts.thisWeek / s.workouts.target} />
          </div>

          {s.notes.length > 0 && (
            <Card className="p-4"><h2 className="mb-2 text-sm font-semibold">Observaciones</h2>
              <ul className="space-y-1 text-sm">{s.notes.map((n) => <li key={n} className="flex gap-2"><span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />{n}</li>)}</ul>
            </Card>
          )}

          <div className="grid gap-3 lg:grid-cols-2">
            <ChartCard title="Peso" subtitle="Últimos 90 días" table={{ columns: ['Fecha', 'Peso (kg)'], rows: [...d.weight].reverse().map((p) => [dayLabel(p.date), es(p.value, 1)]) }}>
              {d.weight.length < 2 ? <EmptyState title="Faltan datos" hint="Registra al menos dos pesos para ver la evolución." /> :
                <TrendLine data={d.weight.map((p) => ({ label: dayLabel(p.date), w: p.value }))} series={[{ key: 'w', label: 'Peso (kg)', color: 'var(--series-1)' }]} zeroBase={false} format={(v) => `${es(v, 1)} kg`} ariaLabel="Evolución del peso en los últimos 90 días" />}
            </ChartCard>
            <ChartCard title="Entrenos por semana" subtitle="Semana en curso incompleta (*)" table={{ columns: ['Semana', 'Entrenos', 'Minutos'], rows: d.weeks.map((w) => [`${w.label}${w.partial ? ' *' : ''}`, w.sessions, w.minutes]) }}>
              <ColumnsChart data={d.weeks.map((w) => ({ label: `${w.label}${w.partial ? '*' : ''}`, n: w.sessions }))} series={[{ key: 'n', label: 'Entrenos', color: 'var(--series-2)' }]} format={(v) => `${es(v)} entrenos`} ariaLabel="Entrenos por semana, últimas 8 semanas" />
            </ChartCard>
            <ChartCard title="Pasos" subtitle="Últimos registros" table={{ columns: ['Fecha', 'Pasos'], rows: [...d.steps].reverse().map((p) => [dayLabel(p.date), es(p.value)]) }}>
              {d.steps.length === 0 ? <EmptyState title="Sin pasos registrados" /> : <ColumnsChart data={d.steps.map((p) => ({ label: dayLabel(p.date), n: p.value }))} series={[{ key: 'n', label: 'Pasos', color: 'var(--series-3)' }]} format={(v) => `${es(v)} pasos`} labelLast={false} ariaLabel="Pasos diarios recientes" />}
            </ChartCard>
            <ChartCard title="Sueño" subtitle="Últimos registros" table={{ columns: ['Fecha', 'Horas'], rows: [...d.sleep].reverse().map((p) => [dayLabel(p.date), es(p.value, 1)]) }}>
              {d.sleep.length === 0 ? <EmptyState title="Sin sueño registrado" /> : <ColumnsChart data={d.sleep.map((p) => ({ label: dayLabel(p.date), n: p.value }))} series={[{ key: 'n', label: 'Horas', color: 'var(--series-4)' }]} format={(v) => `${es(v, 1)} h`} ariaLabel="Horas de sueño recientes" />}
            </ChartCard>
          </div>
        </>
      )}

      {tab === 'workouts' && <WorkoutList workouts={d.workouts} onEdit={(workout) => setWk({ open: true, workout })} />}
      {tab === 'log' && <MetricLog metrics={d.metrics} />}

      <MetricForm key={String(metric)} open={metric} onClose={() => setMetric(false)} />
      <WorkoutForm open={wk.open} onClose={() => setWk({ open: false })} workout={wk.workout} />
      <GoalsForm key={JSON.stringify(d.customGoals)} open={goals} onClose={() => setGoals(false)} goals={d.customGoals} />
    </div>
  );
}

function WorkoutList({ workouts, onEdit }: { workouts: WorkoutDTO[]; onEdit: (w: WorkoutDTO) => void }) {
  const { pending, error, run } = useRun();
  const planned = workouts.filter((w) => w.planned).sort((a, b) => a.date.localeCompare(b.date));
  const done = workouts.filter((w) => !w.planned);
  if (workouts.length === 0) return <Card className="p-6"><EmptyState icon={<Dumbbell size={28} />} title="Sin entrenos" hint="Añade uno con «Entreno»." /></Card>;
  const row = (w: WorkoutDTO) => (
    <li key={w.id} className="flex items-center gap-3 py-2.5">
      <button onClick={() => onEdit(w)} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm font-medium hover:text-primary">{w.title}</span>
        <span className="text-xs text-muted-foreground">{when(w.date)} · {w.minutes} min{w.calories ? ` · ${es(w.calories)} kcal` : ''}</span>
      </button>
      <Badge>{WORKOUT_LABEL[w.kind as WorkoutKind] ?? w.kind}</Badge>
      {w.planned && <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => completeWorkoutAction(w.id))} aria-label={`Marcar «${w.title}» como hecho`}><Check size={14} /> Hecho</Button>}
    </li>
  );
  return (
    <div className="space-y-4">
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {planned.length > 0 && <section aria-label="Planificados"><h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Planificados · {planned.length}</h2><ul className="divide-y rounded-2xl border bg-card px-4">{planned.map(row)}</ul></section>}
      <section aria-label="Realizados"><h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Realizados · últimos 90 días · {done.length}</h2>
        {done.length === 0 ? <p className="text-sm text-muted-foreground">Aún no hay entrenos realizados.</p> : <ul className="divide-y rounded-2xl border bg-card px-4">{done.map(row)}</ul>}</section>
    </div>
  );
}

function MetricLog({ metrics }: { metrics: HealthData['metrics'] }) {
  const { pending, error, run } = useRun();
  if (metrics.length === 0) return <Card className="p-6"><EmptyState icon={<Scale size={28} />} title="Sin mediciones" hint="Registra peso, pasos o sueño con «Medición»." /></Card>;
  return (
    <div className="space-y-2">
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <ul className="divide-y rounded-2xl border bg-card px-4">
        {metrics.map((m) => {
          const meta = METRIC_META[m.kind as MetricKind];
          return (
            <li key={m.id} className="flex items-center gap-3 py-2.5 text-sm">
              <span className="w-20 shrink-0 text-xs text-muted-foreground">{dayLabel(m.date)}</span>
              <span className="flex-1">{meta?.label ?? m.kind}</span>
              <span className="font-medium tabular-nums">{es(m.value, meta?.decimals ?? 1)} {meta?.unit}</span>
              {m.source !== 'manual' && <Badge>{m.source}</Badge>}
              <Button variant="ghost" size="icon" className={cn('h-7 w-7 text-muted-foreground')} disabled={pending} aria-label={`Eliminar ${meta?.label ?? m.kind} del ${dayLabel(m.date)}`}
                onClick={() => { if (confirm('¿Eliminar esta medición?')) run(() => deleteMetricAction(m.id)); }}><Trash2 size={14} /></Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
