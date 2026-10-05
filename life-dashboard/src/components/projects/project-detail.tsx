'use client';
import { ArrowLeft, CalendarDays, Pencil, Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { ListView } from '@/components/tasks/list-view';
import { TaskForm } from '@/components/tasks/task-form';
import type { ProjectOption, TaskDTO } from '@/components/tasks/types';
import { Badge, Button, Card } from '@/components/ui/primitives';
import { PROJECT_STATUS_LABEL, type ProjectStatus } from '@/lib/projects';
import { PRIORITY_LABEL } from '@/lib/tasks';
import { HealthBadge, ProgressBar, fmtTarget } from './parts';
import { ProjectForm } from './project-form';
import type { ProjectDTO } from './types';

export function ProjectDetail({ project, tasks, projects }: { project: ProjectDTO; tasks: TaskDTO[]; projects: ProjectOption[] }) {
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState<{ open: boolean; task?: TaskDTO | null; parentId?: string }>({ open: false });
  const [showDone, setShowDone] = useState(false);
  const roots = tasks.filter((t) => !t.parentId && (showDone || t.status !== 'done'));
  const ids = new Set(roots.map((r) => r.id));
  const visible = tasks.filter((t) => (t.parentId ? ids.has(t.parentId) : ids.has(t.id)));
  const s = project.stats;
  return (
    <div className="space-y-4">
      <Link href="/projects" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={14} /> Proyectos</Link>
      <Card className="p-5">
        <div className="flex flex-wrap items-start gap-3">
          <span className="mt-2 h-3 w-3 shrink-0 rounded-full" style={{ background: project.color }} aria-hidden />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold">{project.name}</h1>
            {project.description && <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>}
          </div>
          <Button variant="outline" size="sm" onClick={() => setEdit(true)}><Pencil size={14} /> Editar</Button>
        </div>
        <div className="mt-4 space-y-1.5">
          <div className="flex justify-between text-sm"><span>{s.done} de {s.total} tareas hechas</span><span className="font-medium tabular-nums">{Math.round(s.progress * 100)} %</span></div>
          <ProgressBar pct={s.progress} color={project.color} label={`Progreso de ${project.name}`} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <HealthBadge health={s.health} />
          <span className="text-xs text-muted-foreground">{s.reason}</span>
          <span className="ml-auto flex flex-wrap gap-1.5">
            <Badge>{PROJECT_STATUS_LABEL[project.status as ProjectStatus]}</Badge>
            <Badge>Prioridad {PRIORITY_LABEL[project.priority]?.toLowerCase()}</Badge>
            {project.targetDate && <Badge><CalendarDays size={11} />Objetivo {fmtTarget(project.targetDate)}</Badge>}
          </span>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <h2 className="mr-auto text-lg font-semibold">Tareas</h2>
        <label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Mostrar completadas</label>
        <Button onClick={() => setForm({ open: true })}><Plus size={16} /> Nueva tarea</Button>
      </div>
      <ListView tasks={visible} all={tasks} onEdit={(task) => setForm({ open: true, task })} onAddSub={(parentId) => setForm({ open: true, parentId })} />

      <TaskForm open={form.open} onClose={() => setForm({ open: false })} task={form.task} parentId={form.parentId} projects={projects} defaultProjectId={project.id} />
      <ProjectForm open={edit} onClose={() => setEdit(false)} project={project} />
    </div>
  );
}
