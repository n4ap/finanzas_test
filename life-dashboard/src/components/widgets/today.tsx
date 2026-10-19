import { AlertCircle, CalendarClock, Clock, Compass, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { formatTime, relativeDay } from '@/lib/utils';
import type { DashboardData } from '@/server/dashboard-data';
import { isOverdue } from '@/server/insights';
import { Row, WidgetFrame } from './frame';

export function MyDayWidget({ d }: { d: DashboardData }) {
  const startOfToday = new Date(d.now.getFullYear(), d.now.getMonth(), d.now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 86_400_000);
  const todayTasks = d.taskLite.filter((t) => t.status !== 'done' && t.dueDate && t.dueDate < endOfToday);
  const items = [
    ...d.todayEvents.map((e) => ({ key: `e${e.id}`, at: e.startsAt, label: e.title, sub: e.location ?? 'Evento', kind: 'event' as const, done: e.endsAt < d.now })),
    ...todayTasks.map((t) => ({ key: `t${t.id}`, at: t.dueDate!, label: t.title, sub: isOverdue(t, d.now) ? 'Tarea atrasada' : 'Tarea para hoy', kind: 'task' as const, done: false })),
  ].sort((a, b) => (a.kind === b.kind ? a.at.getTime() - b.at.getTime() : a.kind === 'task' ? 1 : -1));
  return (
    <WidgetFrame title="Mi día" icon={CalendarClock} href="/calendar">
      {items.length === 0 ? <EmptyState title="Día despejado" hint="No tienes eventos ni tareas para hoy." /> : (
        <ol className="relative space-y-0.5 border-l pl-4">
          {items.map((i) => (
            <li key={i.key} className={`relative py-1.5 ${i.done ? 'opacity-50' : ''}`}>
              <span className={`absolute -left-[21px] top-3 h-2.5 w-2.5 rounded-full border-2 border-card ${i.kind === 'event' ? 'bg-primary' : 'bg-warning'}`} />
              <p className="text-sm font-medium">{i.label}</p>
              <p className="text-xs text-muted-foreground">{i.kind === 'event' ? formatTime(i.at) + ' · ' : ''}{i.sub}</p>
            </li>
          ))}
        </ol>
      )}
    </WidgetFrame>
  );
}

const TONE = { urgent: 'urgent', important: 'important', info: 'neutral' } as const;
const LABEL = { urgent: 'Urgente', important: 'Importante', info: 'Aviso' } as const;

export function PrioritiesWidget({ d }: { d: DashboardData }) {
  const items = d.priorities.slice(0, 6);
  return (
    <WidgetFrame title="Prioridades" icon={AlertCircle}>
      {items.length === 0 ? <EmptyState title="Nada urgente" hint="Todo bajo control." /> : (
        <ul className="divide-y">
          {items.map((p) => (
            <li key={p.id}>
              <Link href={p.href} className="flex items-start justify-between gap-3 rounded-lg py-2 hover:bg-muted/60">
                <div className="min-w-0"><p className="truncate text-sm font-medium">{p.title}</p><p className="truncate text-xs text-muted-foreground">{p.detail}</p></div>
                <Badge tone={TONE[p.severity]}>{LABEL[p.severity]}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {d.priorities.length > items.length && <p className="mt-1 text-xs text-muted-foreground">+{d.priorities.length - items.length} más</p>}
    </WidgetFrame>
  );
}

export function NextActionWidget({ d }: { d: DashboardData }) {
  const a = d.nextAction;
  return (
    <WidgetFrame title="¿Qué debería hacer ahora?" icon={Compass} href="/focus">
      <div className="flex h-full flex-col justify-between gap-3 rounded-xl bg-primary/5 p-3">
        <p className="text-sm leading-relaxed">{a.message}</p>
        <Link href="/focus" className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">
          <Sparkles size={13} /> Empezar en modo Focus
        </Link>
      </div>
    </WidgetFrame>
  );
}

export function CalendarWidget({ d }: { d: DashboardData }) {
  const upcoming = d.events.filter((e) => e.endsAt > d.now).slice(0, 5);
  return (
    <WidgetFrame title="Calendario" icon={Clock} href="/calendar">
      {upcoming.length === 0 ? <EmptyState title="Sin eventos próximos" /> : (
        <ul className="divide-y">
          {upcoming.map((e) => <Row key={e.id} left={e.title} sub={`${relativeDay(e.startsAt, d.now)} · ${formatTime(e.startsAt)}`} right={<span className="inline-block h-2 w-2 rounded-full" style={{ background: e.calendar.color }} title={e.calendar.name} />} />)}
        </ul>
      )}
    </WidgetFrame>
  );
}
