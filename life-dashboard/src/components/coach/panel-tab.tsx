'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Meter } from '@/components/charts/bars';
import { Button, Card } from '@/components/ui/primitives';
import { GOAL_AREAS } from '@/lib/coach';
import { formatEUR, formatNumber } from '@/lib/utils';
import type { CoachData } from '@/server/coach/queries';
import { InsightList } from './insight-list';
import type { CoachTab } from './types';

function Block({ emoji, title, children, href }: { emoji: string; title: string; children: ReactNode; href?: string }) {
  return (
    <Card className="p-4">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold"><span aria-hidden>{emoji}</span>{title}{href && <Link href={href} className="ml-auto text-xs font-normal text-primary hover:underline">Ver</Link>}</h2>
      <dl className="space-y-1 text-sm">{children}</dl>
    </Card>
  );
}
function Row({ k, v }: { k: string; v: ReactNode }) {
  return <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{v ?? <span className="font-normal text-muted-foreground">—</span>}</dd></div>;
}
const of10 = (n: number | null | undefined) => (n == null ? null : `${n}/10`);

/** «Mi dashboard personal»: objetivos, salud, finanzas, trabajo, mente, relaciones, aprendizaje, alertas y prioridades. */
export function PanelTab({ d, go }: { d: CoachData; go: (t: CoachTab) => void }) {
  const p = d.panel;
  const area = (id: string) => GOAL_AREAS.find((a) => a.id === id);
  const reviewedToday = d.reviews.daily[0]?.period === d.today;
  return (
    <div className="space-y-4">
      {!d.interview.complete && (
        <Card className="flex flex-wrap items-center gap-3 border-primary/40 bg-primary/5 p-4">
          <p className="mr-auto text-sm"><strong>Primera sesión:</strong> {d.interview.answered === 0 ? 'empieza la entrevista inicial (8 bloques cortos) para que el coach te conozca.' : `llevas ${d.interview.answered} de ${d.interview.total} respuestas de la entrevista.`}</p>
          <Button onClick={() => go('mapa')}>{d.interview.answered === 0 ? 'Empezar entrevista' : 'Continuar'}</Button>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <h2 className="mb-2 text-sm font-semibold">🚀 Hoy</h2>
          {d.focus.important.length ? (
            <ol className="list-decimal space-y-1 pl-5 text-sm">{d.focus.important.map((x) => <li key={x.id}>{x.title}{x.kind === 'goal' && <span className="ml-1 text-xs text-muted-foreground">(objetivo de la semana)</span>}</li>)}</ol>
          ) : <p className="text-sm text-muted-foreground">No hay nada urgente para hoy. Elige 1-3 cosas importantes en <Link className="text-primary hover:underline" href="/tasks">Tareas</Link> o define tus objetivos de la semana.</p>}
          {d.focus.now && <p className="mt-3 rounded-lg bg-muted p-2 text-sm"><strong>Acción ahora:</strong> {d.focus.now}</p>}
          {d.focus.postponedCount > 0 && <p className="mt-2 text-sm text-muted-foreground">Estás posponiendo {d.focus.postponedCount} {d.focus.postponedCount === 1 ? 'tarea' : 'tareas'}{d.focus.postponed[0] ? ` (la más antigua: «${d.focus.postponed[0].title}», ${d.focus.postponed[0].days} días)` : ''}. ¿Eliminar, delegar o agendar?</p>}
          {!reviewedToday && <Button variant="outline" size="sm" className="mt-3" onClick={() => go('revisiones')}>Hacer la revisión de hoy (2 min)</Button>}
        </Card>
        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold">⚠️ Alertas</h2>
          <InsightList items={d.insights} max={4} />
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Block emoji="🎯" title="Objetivos" href="/coach?tab=objetivos">
          {p.goal ? (
            <>
              <Row k="Principal" v={<span>{area(p.goal.area)?.emoji} {p.goal.title}</span>} />
              <div className="py-1"><Meter pct={p.goal.progress / 100} status="ok" label={`Progreso: ${p.goal.progress} %`} /></div>
              <Row k="Progreso" v={`${p.goal.progress} %`} />
              <Row k="Próxima acción" v={p.goal.nextAction} />
            </>
          ) : <p className="text-sm text-muted-foreground">Aún no hay objetivo de 90 días.</p>}
        </Block>
        <Block emoji="🏋️" title="Salud" href="/health">
          <Row k="Entrenamiento" v={p.health.workouts} />
          <Row k="Sueño" v={p.health.sleep} />
          <Row k="Pasos" v={p.health.steps !== null ? `${formatNumber(p.health.steps)}/día` : null} />
          <Row k="Recuperación" v={of10(p.health.recovery)} />
        </Block>
        <Block emoji="💰" title="Finanzas (este mes)" href="/finance">
          <Row k="Ingresos" v={formatEUR(p.finance.income)} />
          <Row k="Gastos" v={formatEUR(p.finance.expenses)} />
          <Row k="Ahorro" v={`${formatEUR(p.finance.saving)}${p.finance.income > 0 ? ` (${Math.round(p.finance.savingRate * 100)} %)` : ''}`} />
          <Row k="Inversiones" v={formatEUR(p.finance.investments)} />
          <Row k="Patrimonio" v={formatEUR(p.finance.netWorth)} />
        </Block>
        <Block emoji="💼" title="Trabajo" href="/projects">
          <Row k="Prioridad" v={p.work.priority} />
          <Row k="Proyectos activos" v={p.work.projects} />
          <Row k="Próxima acción" v={p.work.nextAction} />
        </Block>
        <Block emoji="🧠" title="Mente">
          {p.mind ? (
            <>
              <Row k="Ánimo" v={of10(p.mind.mood)} />
              <Row k="Estrés" v={of10(p.mind.stress)} />
              <Row k="Energía" v={of10(p.mind.energy)} />
              <p className="pt-1 text-xs text-muted-foreground">Según tu revisión del {p.mind.day === d.today ? 'día de hoy' : p.mind.day.split('-').reverse().join('/')}.</p>
            </>
          ) : <p className="text-sm text-muted-foreground">Haz la revisión diaria para ver tu estado.</p>}
        </Block>
        <Block emoji="❤️" title="Relaciones" href="/family">
          <Row k="Puntuación semanal" v={of10(p.relations.score)} />
          <Row k="Próximo cumpleaños" v={p.relations.nextBirthday ? `${p.relations.nextBirthday.name} (${p.relations.nextBirthday.key.split('-').reverse().join('/')})` : null} />
        </Block>
        <Block emoji="📚" title="Aprendizaje">
          {p.learning.length ? p.learning.map((g) => <Row key={g.title} k={g.title} v={g.nextAction} />) : <p className="text-sm text-muted-foreground">Sin objetivos de crecimiento activos.</p>}
        </Block>
      </div>
    </div>
  );
}
