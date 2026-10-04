'use client';
import { CalendarClock, CheckCircle2, Compass, Target } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge, Card } from '@/components/ui/primitives';
import { formatTime } from '@/lib/utils';

export interface FocusProps {
  nextActionMessage: string;
  current: { title: string; estimateMinutes: number | null } | null;
  nextEvent: { title: string; startsAt: string } | null;
  goal: { done: number; total: number };
}

function useNow() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  return now;
}

function remaining(ms: number) {
  if (ms <= 0) return 'Ahora';
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h} h ${m} min` : `${m} min ${String(s % 60).padStart(2, '0')} s`;
}

export function FocusView({ nextActionMessage, current, nextEvent, goal }: FocusProps) {
  const now = useNow();
  const [showAdvice, setShowAdvice] = useState(false);
  const pct = goal.total ? Math.round((goal.done / goal.total) * 100) : 0;
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 py-4">
      <Card className="p-6">
        <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground"><Target size={14} /> Tarea actual</p>
        {current ? (<><p className="text-2xl font-semibold leading-tight">{current.title}</p>{current.estimateMinutes && <Badge className="mt-3">~{current.estimateMinutes} min</Badge>}</>) : <p className="text-lg text-muted-foreground">Sin tarea en curso. Pulsa «¿Qué hago ahora?».</p>}
      </Card>
      <Card className="p-6">
        <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground"><CalendarClock size={14} /> Siguiente evento</p>
        {nextEvent ? (
          <div className="flex items-end justify-between gap-3">
            <div><p className="text-lg font-medium">{nextEvent.title}</p><p className="text-sm text-muted-foreground">{formatTime(new Date(nextEvent.startsAt))}</p></div>
            <div className="text-right"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">Tiempo restante</p><p className="text-2xl font-semibold tabular-nums" suppressHydrationWarning>{now ? remaining(new Date(nextEvent.startsAt).getTime() - now) : '—'}</p></div>
          </div>
        ) : <p className="text-muted-foreground">No tienes más eventos próximos.</p>}
      </Card>
      <Card className="p-6">
        <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground"><CheckCircle2 size={14} /> Objetivo del día</p>
        <p className="font-medium">{goal.total === 0 ? 'Sin tareas para hoy' : `${goal.done} de ${goal.total} tareas de hoy completadas`}</p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progreso del día"><div className="h-full rounded-full bg-success transition-all" style={{ width: `${pct}%` }} /></div>
      </Card>
      <button onClick={() => setShowAdvice((s) => !s)} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary font-medium text-primary-foreground hover:opacity-90"><Compass size={18} /> ¿Qué hago ahora?</button>
      {showAdvice && <Card className="animate-fade-up bg-primary/5 p-4 text-sm leading-relaxed" role="status">{nextActionMessage}</Card>}
    </div>
  );
}
