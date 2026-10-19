'use client';
import { ListTodo, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { Meter } from '@/components/charts/bars';
import { Dialog } from '@/components/ui/dialog';
import { Badge, Button, Card, Field, Input, Select, Textarea } from '@/components/ui/primitives';
import { useRun } from '@/components/ui/use-run';
import { GOAL_AREAS, GOAL_LEVELS, MAX_FOCUS_GOALS, goalAreaRank, type GoalLevel } from '@/lib/coach';
import { cn } from '@/lib/utils';
import { createGoalAction, deleteGoalAction, goalActionToTaskAction, setGoalProgressAction, updateGoalAction } from '@/server/actions/coach';
import type { CoachData } from '@/server/coach/queries';

type GoalDTO = CoachData['goals'][number];
const LEVEL_ORDER: GoalLevel[] = ['vision', 'annual', 'quarterly', 'weekly'];
const area = (id: string) => GOAL_AREAS.find((a) => a.id === id);
const fmtDay = (k: string | null) => (k ? k.split('-').reverse().join('/') : null);

export function GoalsTab({ d }: { d: CoachData }) {
  const [form, setForm] = useState<{ open: boolean; goal?: GoalDTO | null; level?: GoalLevel }>({ open: false });
  const [showClosed, setShowClosed] = useState(false);
  const active = d.goals.filter((g) => g.status === 'active');
  const closed = d.goals.filter((g) => g.status !== 'active');
  const quarterly = active.filter((g) => g.level === 'quarterly').length;

  return (
    <div className="space-y-4">
      <Card className="p-4 text-sm text-muted-foreground">
        De lo grande a lo concreto: <strong>visión → 12 meses → 90 días → esta semana</strong>. Evita objetivos vagos («ponerme en forma»): usa una métrica y una fecha («correr 10 km en menos de 55 min antes del 31/12»). Máximo {MAX_FOCUS_GOALS} objetivos de 90 días a la vez.
      </Card>
      {LEVEL_ORDER.map((lv) => {
        const meta = GOAL_LEVELS.find((l) => l.id === lv)!;
        const goals = active.filter((g) => g.level === lv).sort((a, b) => goalAreaRank(a.area) - goalAreaRank(b.area));
        return (
          <section key={lv} aria-labelledby={`lv-${lv}`}>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h2 id={`lv-${lv}`} className="text-base font-semibold">{meta.label}</h2>
              <span className="mr-auto text-xs text-muted-foreground">{meta.hint}</span>
              {lv === 'quarterly' && <Badge tone={quarterly > MAX_FOCUS_GOALS ? 'urgent' : 'neutral'}>{quarterly}/{MAX_FOCUS_GOALS}</Badge>}
              <Button size="sm" variant="outline" onClick={() => setForm({ open: true, level: lv })}><Plus size={14} aria-hidden /> Añadir</Button>
            </div>
            {goals.length === 0 ? <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">Sin objetivos en este nivel.</p> : (
              <div className="grid gap-3 md:grid-cols-2">{goals.map((g) => <GoalCard key={g.id} g={g} parent={d.goals.find((p) => p.id === g.parentId)} today={d.today} onEdit={() => setForm({ open: true, goal: g })} />)}</div>
            )}
          </section>
        );
      })}
      {closed.length > 0 && (
        <div>
          <Button variant="ghost" size="sm" onClick={() => setShowClosed(!showClosed)}>{showClosed ? 'Ocultar' : 'Ver'} cerrados ({closed.length})</Button>
          {showClosed && <ul className="mt-2 space-y-1 text-sm">{closed.map((g) => <li key={g.id} className="flex items-center gap-2"><Badge tone={g.status === 'done' ? 'success' : 'neutral'}>{g.status === 'done' ? 'Conseguido' : 'Abandonado'}</Badge>{g.title}<button className="ml-auto text-xs text-primary hover:underline" onClick={() => setForm({ open: true, goal: g })}>Editar</button></li>)}</ul>}
        </div>
      )}
      <GoalForm key={form.goal?.id ?? form.level ?? 'x'} open={form.open} goal={form.goal} level={form.level} goals={d.goals} quarterly={quarterly} onClose={() => setForm({ open: false })} />
    </div>
  );
}

function GoalCard({ g, parent, today, onEdit }: { g: GoalDTO; parent?: GoalDTO; today: string; onEdit: () => void }) {
  const { pending, error, run } = useRun();
  const [note, setNote] = useState<string | null>(null);
  const a = area(g.area);
  const late = g.dueDate && g.dueDate < today && g.progress < 100;
  return (
    <Card className="p-4">
      <div className="flex items-start gap-2">
        <span aria-hidden className="text-lg">{a?.emoji}</span>
        <div className="mr-auto min-w-0">
          <h3 className="font-medium">{g.title}</h3>
          <p className="text-xs text-muted-foreground">{a?.label}{parent && <> · parte de «{parent.title}»</>}{g.dueDate && <> · <span className={cn(late && 'font-medium text-danger')}>límite {fmtDay(g.dueDate)}</span></>}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Editar «${g.title}»`} onClick={onEdit}><Pencil size={14} /></Button>
      </div>
      {g.level !== 'vision' && (
        <>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
            {g.why && <><dt className="text-muted-foreground">Motivo</dt><dd>{g.why}</dd></>}
            {g.metric && <><dt className="text-muted-foreground">Métrica</dt><dd>{g.metric}{(g.baseline || g.target) && <span className="text-muted-foreground"> · {g.baseline ?? '?'} → {g.target ?? '?'}</span>}</dd></>}
            <dt className="text-muted-foreground">Próxima acción</dt><dd className={cn(!g.nextAction && 'text-warning')}>{g.nextAction ?? 'Sin definir'}</dd>
            {g.obstacles && <><dt className="text-muted-foreground">Obstáculos</dt><dd>{g.obstacles}</dd></>}
            {g.planB && <><dt className="text-muted-foreground">Plan B</dt><dd>{g.planB}</dd></>}
          </dl>
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1"><Meter pct={g.progress / 100} status={late ? 'warn' : 'ok'} label={`Progreso de «${g.title}»: ${g.progress} %`} /></div>
            <span className="w-10 text-right text-xs tabular-nums">{g.progress} %</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {[-10, 10, 25].map((step) => (
              <Button key={step} size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={pending || (step < 0 ? g.progress === 0 : g.progress === 100)} onClick={() => run(() => setGoalProgressAction(g.id, Math.max(0, Math.min(100, g.progress + step))))}>{step > 0 ? '+' : '−'}{Math.abs(step)} %</Button>
            ))}
            {g.nextAction && <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs" disabled={pending} onClick={() => run(() => goalActionToTaskAction(g.id, today), () => setNote('Tarea creada para hoy en Tareas.'))}><ListTodo size={13} aria-hidden /> Crear tarea</Button>}
          </div>
        </>
      )}
      {g.level === 'vision' && g.why && <p className="mt-2 text-sm text-muted-foreground">{g.why}</p>}
      {note && <p role="status" className="mt-2 text-xs text-success">{note}</p>}
      {error && <p role="alert" className="mt-2 text-xs text-danger">{error}</p>}
    </Card>
  );
}

function GoalForm({ open, goal, level, goals, quarterly, onClose }: { open: boolean; goal?: GoalDTO | null; level?: GoalLevel; goals: GoalDTO[]; quarterly: number; onClose: () => void }) {
  const { pending, error, run } = useRun();
  const editing = !!goal;
  const [lv, setLv] = useState<GoalLevel>((goal?.level as GoalLevel) ?? level ?? 'quarterly');
  const parents = goals.filter((g) => g.status === 'active' && g.id !== goal?.id && LEVEL_ORDER.indexOf(g.level as GoalLevel) < LEVEL_ORDER.indexOf(lv));
  const isVision = lv === 'vision';
  const tooMany = !editing && lv === 'quarterly' && quarterly >= MAX_FOCUS_GOALS;
  return (
    <Dialog open={open} onClose={onClose} title={editing ? 'Editar objetivo' : 'Nuevo objetivo'} wide>
      <form className="space-y-3" onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const v = (k: string) => String(f.get(k) ?? '');
        const payload = { level: lv, area: v('area'), title: v('title'), why: v('why'), metric: v('metric'), baseline: v('baseline'), target: v('target'), progress: v('progress') || '0', dueDate: v('dueDate'), nextAction: v('nextAction'), obstacles: v('obstacles'), planB: v('planB'), parentId: v('parentId'), status: v('status') || 'active' };
        run(() => (editing ? updateGoalAction(goal!.id, payload) : createGoalAction(payload)), () => onClose());
      }}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Nivel"><Select value={lv} onChange={(e) => setLv(e.target.value as GoalLevel)} aria-label="Nivel">{GOAL_LEVELS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</Select></Field>
          <Field label="Área"><Select name="area" defaultValue={goal?.area ?? 'salud'}>{GOAL_AREAS.map((a) => <option key={a.id} value={a.id}>{a.emoji} {a.label}</option>)}</Select></Field>
          {editing ? <Field label="Estado"><Select name="status" defaultValue={goal!.status}><option value="active">Activo</option><option value="done">Conseguido</option><option value="dropped">Abandonado</option></Select></Field>
            : <Field label="Fecha límite"><Input name="dueDate" type="date" /></Field>}
        </div>
        {tooMany && <p role="note" className="rounded-lg bg-warning/10 p-2 text-sm text-warning">Ya tienes {quarterly} objetivos de 90 días. ¿Seguro que este es más importante que alguno de ellos? Más foco = más resultados.</p>}
        <Field label="Objetivo"><Input name="title" required minLength={3} maxLength={160} defaultValue={goal?.title} autoFocus placeholder={isVision ? 'Ser una persona sana, con tiempo para mi familia y sin deudas' : 'Correr 10 km en menos de 55 minutos'} /></Field>
        <Field label={isVision ? '¿Por qué es importante?' : 'Motivo'}><Textarea name="why" rows={2} maxLength={500} defaultValue={goal?.why ?? ''} /></Field>
        {!isVision && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Métrica"><Input name="metric" maxLength={200} defaultValue={goal?.metric ?? ''} placeholder="Tiempo en 10 km" /></Field>
              <Field label="Situación actual"><Input name="baseline" maxLength={200} defaultValue={goal?.baseline ?? ''} placeholder="62 min" /></Field>
              <Field label="Objetivo final"><Input name="target" maxLength={200} defaultValue={goal?.target ?? ''} placeholder="< 55 min" /></Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {editing && <Field label="Fecha límite"><Input name="dueDate" type="date" defaultValue={goal?.dueDate ?? ''} /></Field>}
              <Field label="Progreso (%)"><Input name="progress" type="number" min={0} max={100} defaultValue={goal?.progress ?? 0} /></Field>
              <Field label="Objetivo superior" className={editing ? '' : 'sm:col-span-2'}><Select name="parentId" defaultValue={goal?.parentId ?? ''}><option value="">— Ninguno —</option>{parents.map((p) => <option key={p.id} value={p.id}>{GOAL_LEVELS.find((l) => l.id === p.level)?.label}: {p.title}</option>)}</Select></Field>
            </div>
            <Field label="Próxima acción (concreta, se puede hacer en < 1 h)"><Input name="nextAction" maxLength={200} defaultValue={goal?.nextAction ?? ''} placeholder="Martes 19:00: rodaje de 5 km" /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Obstáculos"><Textarea name="obstacles" rows={2} maxLength={500} defaultValue={goal?.obstacles ?? ''} /></Field>
              <Field label="Plan B"><Textarea name="planB" rows={2} maxLength={500} defaultValue={goal?.planB ?? ''} /></Field>
            </div>
          </>
        )}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-between gap-2 pt-1">
          {editing ? <Button type="button" variant="ghost" className="text-danger" disabled={pending} onClick={() => { if (confirm(`¿Borrar «${goal!.title}»? Sus objetivos dependientes se conservan.`)) run(() => deleteGoalAction(goal!.id), () => onClose()); }}>Borrar</Button> : <span />}
          <div className="flex gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={pending}>Guardar</Button></div>
        </div>
      </form>
    </Dialog>
  );
}
