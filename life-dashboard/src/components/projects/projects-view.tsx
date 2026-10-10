'use client';
import { Briefcase, CalendarDays, Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Badge, Button, Card, EmptyState, Segmented } from '@/components/ui/primitives';
import { PROJECT_STATUS_LABEL, type ProjectStatus } from '@/lib/projects';
import { PRIORITY_LABEL } from '@/lib/tasks';
import { HealthBadge, ProgressBar, fmtTarget } from './parts';
import { ProjectForm } from './project-form';
import type { ProjectDTO } from './types';

type Filter = 'open' | 'all' | 'done';

export function ProjectsView({ projects }: { projects: ProjectDTO[] }) {
  const [filter, setFilter] = useState<Filter>('open');
  const [form, setForm] = useState(false);
  const shown = projects.filter((p) => (filter === 'all' ? true : filter === 'done' ? p.status === 'done' || p.stats.health === 'done' : p.status !== 'done' && p.stats.health !== 'done'));
  const attention = projects.filter((p) => p.stats.health === 'late' || p.stats.health === 'at_risk').length;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold">Proyectos</h1>
        <Segmented label="Filtro" value={filter} onChange={setFilter} options={[{ value: 'open', label: 'En curso' }, { value: 'done', label: 'Completados' }, { value: 'all', label: 'Todos' }]} />
        <Button onClick={() => setForm(true)}><Plus size={16} /> Nuevo proyecto</Button>
      </div>
      {attention > 0 && <p role="status" className="rounded-xl bg-warning/10 px-3 py-2 text-sm text-warning">{attention === 1 ? '1 proyecto necesita atención' : `${attention} proyectos necesitan atención`} (en riesgo o fuera de plazo).</p>}
      {shown.length === 0 ? (
        <Card className="p-6"><EmptyState icon={<Briefcase size={28} />} title={projects.length ? 'Ningún proyecto con este filtro' : 'Aún no tienes proyectos'} hint="Un proyecto agrupa tareas y mide su avance automáticamente." /></Card>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((p) => (
            <li key={p.id}>
              <Link href={`/projects/${p.id}`} className="block h-full rounded-2xl border bg-card p-4 transition-colors hover:bg-muted/40">
                <div className="flex items-start gap-2">
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color }} aria-hidden />
                  <h2 className="min-w-0 flex-1 font-semibold">{p.name}</h2>
                  <HealthBadge health={p.stats.health} />
                </div>
                {p.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>}
                <div className="mt-3 space-y-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground"><span>{p.stats.done}/{p.stats.total} tareas</span><span className="tabular-nums">{Math.round(p.stats.progress * 100)} %</span></div>
                  <ProgressBar pct={p.stats.progress} color={p.color} label={`Progreso de ${p.name}`} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{p.stats.reason}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge>{PROJECT_STATUS_LABEL[p.status as ProjectStatus]}</Badge>
                  <Badge>Prioridad {PRIORITY_LABEL[p.priority]?.toLowerCase()}</Badge>
                  {p.targetDate && <Badge><CalendarDays size={11} />{fmtTarget(p.targetDate)}</Badge>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <ProjectForm open={form} onClose={() => setForm(false)} />
    </div>
  );
}
