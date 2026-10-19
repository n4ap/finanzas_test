import Link from 'next/link';
import { Briefcase, CheckSquare, Mail, Newspaper } from 'lucide-react';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { relativeDay } from '@/lib/utils';
import type { DashboardData } from '@/server/dashboard-data';
import { isOverdue } from '@/server/insights';
import { Row, WidgetFrame } from './frame';

export function EmailWidget({ d }: { d: DashboardData }) {
  const unread = d.emails.filter((e) => !e.read).length;
  const needsReply = d.emails.filter((e) => e.needsReply && !e.replied);
  const shown = d.emails.filter((e) => !e.read).slice(0, 4);
  return (
    <WidgetFrame title="Email" icon={Mail} href="/email">
      <div className="mb-2 flex gap-2"><Badge tone="primary">{unread} sin leer</Badge>{needsReply.length > 0 && <Badge tone="important">{needsReply.length} por responder</Badge>}</div>
      {shown.length === 0 ? <EmptyState title="Bandeja al día" /> : <ul className="divide-y">{shown.map((e) => <Row key={e.id} left={e.subject} sub={e.fromName} right={e.deadline ? `antes ${e.deadline.toLocaleDateString('es-ES', { weekday: 'short' })}` : undefined} />)}</ul>}
    </WidgetFrame>
  );
}

export function TasksWidget({ d }: { d: DashboardData }) {
  const open = d.taskLite.filter((t) => t.status !== 'done');
  const overdue = open.filter((t) => isOverdue(t, d.now));
  const shown = [...overdue, ...open.filter((t) => !isOverdue(t, d.now) && (t.status === 'in_progress' || t.status === 'next'))].slice(0, 5);
  return (
    <WidgetFrame title="Tareas" icon={CheckSquare} href="/tasks">
      <div className="mb-2 flex gap-2"><Badge>{open.length} abiertas</Badge>{overdue.length > 0 && <Badge tone="urgent">{overdue.length} atrasadas</Badge>}</div>
      {shown.length === 0 ? <EmptyState title="Sin tareas pendientes" /> : (
        <ul className="divide-y">{shown.map((t) => <Row key={t.id} left={t.title} sub={t.projectName ?? 'Sin proyecto'} right={t.dueDate ? relativeDay(t.dueDate, d.now) : undefined} />)}</ul>
      )}
    </WidgetFrame>
  );
}

export function NewsWidget({ d }: { d: DashboardData }) {
  const top = d.topNews;
  return (
    <WidgetFrame title="Lo importante de hoy" icon={Newspaper} href="/news">
      {top.length === 0 ? <EmptyState title="Sin noticias" hint="Configura tus fuentes en Ajustes." /> : (
        <ol className="space-y-2">
          {top.map((n, i) => (
            <li key={n.id} className="flex gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold">{i + 1}</span>
              <div className="min-w-0"><p className="line-clamp-2 text-sm font-medium">{n.title}</p><p className="text-xs text-muted-foreground">{n.source} · {n.category}</p></div>
            </li>
          ))}
        </ol>
      )}
    </WidgetFrame>
  );
}

export function ProjectsWidget({ d }: { d: DashboardData }) {
  return (
    <WidgetFrame title="Proyectos" icon={Briefcase} href="/projects">
      {d.projects.length === 0 ? <EmptyState title="Sin proyectos" /> : (
        <ul className="space-y-3">
          {d.projects.slice(0, 4).map((p) => (
            <li key={p.id}>
              <div className="mb-1 flex items-center justify-between gap-2 text-sm"><Link href={`/projects/${p.id}`} className="truncate hover:text-primary">{p.name}</Link><span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">{(p.health === 'late' || p.health === 'at_risk') && <span className="font-medium text-warning">{p.health === 'late' ? 'Fuera de plazo' : 'En riesgo'}</span>}{Math.round(p.progress * 100)}%</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(p.progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`Progreso de ${p.name}`}>
                <div className="h-full rounded-full" style={{ width: `${Math.round(p.progress * 100)}%`, background: p.color }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </WidgetFrame>
  );
}
