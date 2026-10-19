'use client';
import { useState } from 'react';
import { Button, Card, Segmented, Textarea } from '@/components/ui/primitives';
import { useRun } from '@/components/ui/use-run';
import { DAILY_QUESTIONS, MONTHLY_QUESTIONS, SCORE_AREAS, WEEKLY_QUESTIONS, addDays, prevMonth } from '@/lib/coach';
import { cn, formatEUR, formatNumber } from '@/lib/utils';
import { priorityToTaskAction, saveReviewAction } from '@/server/actions/coach';
import type { CoachData } from '@/server/coach/queries';

type Sub = 'daily' | 'weekly' | 'monthly';
const fmtDay = (k: string) => new Date(`${k}T12:00:00Z`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const fmtShort = (k: string) => new Date(`${k}T12:00:00Z`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' }).replace('.', '');
const fmtMonth = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' });

function Scale({ name, label, value, min = 1, onChange }: { name: string; label: string; value: number | null; min?: number; onChange: (v: number) => void }) {
  return (
    <label className="block text-sm">
      <span className="flex justify-between"><span>{label}</span><output className="font-semibold tabular-nums">{value ?? '—'}{value !== null && '/10'}</output></span>
      {/* Sin valor, el control muestra el punto medio: un clic o una tecla sobre él también cuenta (si no, elegir justo ese valor no dispararía «change»). */}
      <input type="range" name={name} min={min} max={10} step={1} value={value ?? Math.round((min + 10) / 2)} onChange={(e) => onChange(Number(e.target.value))}
        onClick={(e) => { if (value === null) onChange(Number(e.currentTarget.value)); }} onKeyUp={(e) => { if (value === null && (e.key === 'Enter' || e.key === ' ')) onChange(Number(e.currentTarget.value)); }}
        className={cn('w-full accent-[hsl(var(--primary))]', value === null && 'opacity-50')} aria-label={label} />
    </label>
  );
}

export function ReviewsTab({ d }: { d: CoachData }) {
  const [sub, setSub] = useState<Sub>('daily');
  return (
    <div className="space-y-4">
      <Segmented label="Tipo de revisión" value={sub} onChange={setSub} options={[{ value: 'daily', label: 'Diaria' }, { value: 'weekly', label: 'Semanal' }, { value: 'monthly', label: 'Mensual' }]} />
      {sub === 'daily' && <Daily d={d} />}
      {sub === 'weekly' && <Weekly d={d} />}
      {sub === 'monthly' && <Monthly d={d} />}
    </div>
  );
}

function Daily({ d }: { d: CoachData }) {
  const existing = d.reviews.daily.find((r) => r.period === d.today);
  const [vals, setVals] = useState({ energy: existing?.energy ?? null, mood: existing?.mood ?? null, stress: existing?.stress ?? null });
  const [note, setNote] = useState<string | null>(null);
  const { pending, error, run } = useRun();
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
      <Card className="p-5">
        <h2 className="text-base font-semibold">Revisión de hoy</h2>
        <p className="mb-3 text-sm capitalize text-muted-foreground">{fmtDay(d.today)}{existing && ' · ya guardada (puedes editarla)'}</p>
        <form className="space-y-3" onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const answers = Object.fromEntries(DAILY_QUESTIONS.map((q) => [q.key, String(f.get(q.key) ?? '')]));
          const toTask = f.get('toTask') === 'on' && answers.manana?.trim();
          run(async () => {
            const r = await saveReviewAction({ kind: 'daily', period: d.today, answers, ...vals });
            if (r.ok && toTask) await priorityToTaskAction(answers.manana!, addDays(d.today, 1));
            return r;
          }, () => setNote(toTask ? 'Revisión guardada y prioridad añadida a las tareas de mañana.' : 'Revisión guardada.'));
        }}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Scale name="energy" label="⚡ Energía" value={vals.energy} onChange={(v) => setVals({ ...vals, energy: v })} />
            <Scale name="mood" label="😊 Ánimo" value={vals.mood} onChange={(v) => setVals({ ...vals, mood: v })} />
            <Scale name="stress" label="😣 Estrés" value={vals.stress} onChange={(v) => setVals({ ...vals, stress: v })} />
          </div>
          {DAILY_QUESTIONS.map((q) => (
            <label key={q.key} className="block text-sm"><span className="font-medium">{q.text}</span><Textarea name={q.key} rows={2} maxLength={2000} defaultValue={existing?.answers[q.key] ?? ''} className="mt-1" /></label>
          ))}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="toTask" defaultChecked /> Añadir la prioridad de mañana a mis tareas</label>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          {note && <p role="status" className="text-sm text-success">{note}</p>}
          <div className="flex justify-end"><Button type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Guardar revisión'}</Button></div>
        </form>
      </Card>
      <Card className="h-fit p-4">
        <h3 className="mb-2 text-sm font-semibold">Últimos días</h3>
        {d.reviews.daily.length === 0 ? <p className="text-sm text-muted-foreground">Aún no hay revisiones.</p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-muted-foreground"><th className="text-left font-normal">Día</th><th className="font-normal" title="Energía">⚡</th><th className="font-normal" title="Ánimo">😊</th><th className="font-normal" title="Estrés">😣</th></tr></thead>
            <tbody>{d.reviews.daily.slice(0, 10).map((r) => <tr key={r.period}><td>{fmtShort(r.period)}</td><td className="text-center tabular-nums">{r.energy ?? '—'}</td><td className="text-center tabular-nums">{r.mood ?? '—'}</td><td className="text-center tabular-nums">{r.stress ?? '—'}</td></tr>)}</tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

const cellTone = (v: number | null) => (v === null ? 'text-muted-foreground' : v >= 8 ? 'bg-success/20' : v >= 6 ? 'bg-success/10' : v >= 4 ? 'bg-warning/15' : 'bg-danger/15');

function Weekly({ d }: { d: CoachData }) {
  const thisWeek = d.periods.weekly;
  const [period, setPeriod] = useState(thisWeek);
  const existing = d.reviews.weekly.find((r) => r.period === period);
  const [scores, setScores] = useState<Record<string, number | null>>(() => Object.fromEntries(SCORE_AREAS.map((a) => [a.id, existing?.scores[a.id] ?? null])));
  const [note, setNote] = useState<string | null>(null);
  const { pending, error, run } = useRun();
  const t = d.trends;
  const weeks = t ? t.weeks.slice(-8) : [];
  const switchTo = (p: string) => { setPeriod(p); const ex = d.reviews.weekly.find((r) => r.period === p); setScores(Object.fromEntries(SCORE_AREAS.map((a) => [a.id, ex?.scores[a.id] ?? null]))); setNote(null); };
  const w = d.weekData;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-base font-semibold">Revisión semanal · semana del {fmtShort(period)}</h2>
          <Segmented label="Semana" value={period} onChange={switchTo} options={[{ value: addDays(thisWeek, -7), label: 'Semana pasada' }, { value: thisWeek, label: 'Esta semana' }]} />
        </div>
        <p className="mb-3 rounded-lg bg-muted p-2 text-sm">Datos de los últimos 7 días: {w.workouts}/{w.workoutTarget} entrenos · sueño {w.sleepAvg !== null ? `${formatNumber(w.sleepAvg, 1)} h` : '—'} · {w.stepsAvg !== null ? `${formatNumber(w.stepsAvg)} pasos/día` : 'sin pasos'} · {w.tasksDone} tareas hechas · gastado este mes {formatEUR(w.spent)}</p>
        <form key={period} className="space-y-4" onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const answers = Object.fromEntries(WEEKLY_QUESTIONS.map((q) => [q.key, String(f.get(q.key) ?? '')]));
          const sc = Object.fromEntries(Object.entries(scores).filter(([, v]) => v !== null));
          run(() => saveReviewAction({ kind: 'weekly', period, answers, scores: sc }), () => setNote('Revisión semanal guardada.'));
        }}>
          <fieldset>
            <legend className="mb-1 text-sm font-medium">Puntúa la semana de 0 a 10 <span className="font-normal text-muted-foreground">(no es un juicio: sirve para ver tendencias; deja sin tocar lo que no aplique)</span></legend>
            <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {SCORE_AREAS.map((a) => <Scale key={a.id} name={a.id} min={0} label={`${a.emoji} ${a.label}`} value={scores[a.id] ?? null} onChange={(v) => setScores({ ...scores, [a.id]: v })} />)}
            </div>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            {WEEKLY_QUESTIONS.map((q) => <label key={q.key} className="block text-sm"><span className="font-medium">{q.text}</span><Textarea name={q.key} rows={3} maxLength={2000} defaultValue={existing?.answers[q.key] ?? ''} className="mt-1" /></label>)}
          </div>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          {note && <p role="status" className="text-sm text-success">{note}</p>}
          <div className="flex justify-end"><Button type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Guardar revisión semanal'}</Button></div>
        </form>
      </Card>

      <Card className="overflow-x-auto p-4">
        <h3 className="mb-1 text-sm font-semibold">Tendencias</h3>
        {!t ? <p className="text-sm text-muted-foreground">Las tendencias aparecen a partir de tu primera revisión semanal.</p> : (
          <>
            <p className="mb-2 text-sm text-muted-foreground">
              {t.overall !== null && <>Media de la última semana: <strong>{formatNumber(t.overall, 1)}</strong>. </>}
              {t.best && t.worst && t.best.id !== t.worst.id && <>Mejor: {t.best.emoji} {t.best.label} ({t.best.last}) · a cuidar: {t.worst.emoji} {t.worst.label} ({t.worst.last}).</>}
            </p>
            <table className="w-full min-w-[32rem] text-sm">
              <thead><tr className="text-xs text-muted-foreground"><th className="text-left font-normal">Área</th>{weeks.map((p) => <th key={p} className="font-normal">{fmtShort(p)}</th>)}<th className="font-normal">Tendencia</th></tr></thead>
              <tbody>
                {t.areas.map((a) => (
                  <tr key={a.id}>
                    <td className="whitespace-nowrap py-0.5">{a.emoji} {a.label}</td>
                    {weeks.map((p) => { const v = a.series.find((s) => s.period === p)?.value ?? null; return <td key={p} className={cn('rounded text-center tabular-nums', cellTone(v))}>{v ?? '·'}</td>; })}
                    <td className="text-center text-xs">{a.declining ? <span className="text-danger">↓ 3 sem.</span> : a.improving ? <span className="text-success">↑ 3 sem.</span> : a.delta !== null ? (a.delta > 0 ? `+${a.delta}` : a.delta < 0 ? `−${-a.delta}` : '=') : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Card>
    </div>
  );
}

function Monthly({ d }: { d: CoachData }) {
  const month = d.periods.monthly;
  const [m, setM] = useState(month);
  const existing = d.reviews.monthly.find((r) => r.period === m);
  const cmp = m === month ? d.monthCompare : null;
  const [note, setNote] = useState<string | null>(null);
  const { pending, error, run } = useRun();
  const patterns = (d.trends?.areas ?? []).filter((a) => a.declining || a.improving);
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-base font-semibold capitalize">Revisión de {fmtMonth(m)}</h2>
          <Segmented label="Mes" value={m} onChange={(v) => { setM(v); setNote(null); }} options={[{ value: prevMonth(month), label: 'Mes pasado' }, { value: month, label: 'Este mes' }]} />
        </div>
        {cmp && (
          <div className="mb-4 overflow-x-auto">
            <p className="mb-1 text-sm text-muted-foreground">Media de tus puntuaciones semanales frente a {fmtMonth(cmp.previous)} ({cmp.weeks} y {cmp.previousWeeks} semanas puntuadas).</p>
            {cmp.weeks === 0 ? <p className="text-sm text-muted-foreground">Sin revisiones semanales este mes todavía.</p> : (
              <table className="w-full min-w-[24rem] text-sm">
                <thead><tr className="text-xs text-muted-foreground"><th className="text-left font-normal">Área</th><th className="font-normal">Mes anterior</th><th className="font-normal">Este mes</th><th className="font-normal">Cambio</th></tr></thead>
                <tbody>{cmp.areas.filter((a) => a.current !== null || a.previous !== null).map((a) => (
                  <tr key={a.id}><td>{a.emoji} {a.label}</td><td className="text-center tabular-nums">{a.previous !== null ? formatNumber(a.previous, 1) : '—'}</td><td className="text-center tabular-nums">{a.current !== null ? formatNumber(a.current, 1) : '—'}</td>
                    <td className={cn('text-center tabular-nums', a.delta !== null && a.delta >= 1 && 'text-success', a.delta !== null && a.delta <= -1 && 'text-danger')}>{a.delta === null ? '' : a.delta > 0 ? `+${formatNumber(a.delta, 1)}` : a.delta < 0 ? `−${formatNumber(-a.delta, 1)}` : '='}</td></tr>
                ))}</tbody>
              </table>
            )}
            {patterns.length > 0 && <ul className="mt-2 list-disc pl-5 text-sm">{patterns.map((a) => <li key={a.id}>{a.emoji} {a.label}: {a.declining ? 'baja' : 'sube'} tres semanas seguidas.</li>)}</ul>}
          </div>
        )}
        <form key={m} className="space-y-3" onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          run(() => saveReviewAction({ kind: 'monthly', period: m, answers: Object.fromEntries(MONTHLY_QUESTIONS.map((q) => [q.key, String(f.get(q.key) ?? '')])) }), () => setNote('Revisión mensual guardada.'));
        }}>
          {MONTHLY_QUESTIONS.map((q) => <label key={q.key} className="block text-sm"><span className="font-medium">{q.text}</span><Textarea name={q.key} rows={2} maxLength={2000} defaultValue={existing?.answers[q.key] ?? ''} className="mt-1" /></label>)}
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          {note && <p role="status" className="text-sm text-success">{note}</p>}
          <div className="flex justify-end"><Button type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Guardar revisión mensual'}</Button></div>
        </form>
      </Card>
    </div>
  );
}
