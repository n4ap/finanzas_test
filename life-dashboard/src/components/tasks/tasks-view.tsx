'use client';
import { Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button, Input, Segmented, Select } from '@/components/ui/primitives';
import { KanbanView } from './kanban-view';
import { TaskCalendarView } from './calendar-view';
import { ListView } from './list-view';
import { TaskForm } from './task-form';
import type { ProjectOption, TaskDTO } from './types';

type View = 'list' | 'kanban' | 'calendar';

export function TasksView({ tasks, projects }: { tasks: TaskDTO[]; projects: ProjectOption[] }) {
  const [view, setView] = useState<View>('list');
  const [q, setQ] = useState('');
  const [project, setProject] = useState('');
  const [showDone, setShowDone] = useState(false);
  const [form, setForm] = useState<{ open: boolean; task?: TaskDTO | null; parentId?: string; due?: string }>({ open: false });

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const hideDone = view === 'list' && !showDone;
    const match = (t: TaskDTO) =>
      (!project || t.projectId === project) &&
      (!needle || t.title.toLowerCase().includes(needle) || t.tags.some((g) => g.includes(needle.replace('#', ''))) || (t.description ?? '').toLowerCase().includes(needle));
    const roots = tasks.filter((t) => !t.parentId && match(t) && (!hideDone || t.status !== 'done'));
    const ids = new Set(roots.map((r) => r.id));
    return tasks.filter((t) => (t.parentId ? ids.has(t.parentId) : ids.has(t.id)));
  }, [tasks, q, project, showDone, view]);

  const close = () => setForm({ open: false });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold">Tareas</h1>
        <Segmented label="Vista" value={view} onChange={setView} options={[{ value: 'list', label: 'Lista' }, { value: 'kanban', label: 'Kanban' }, { value: 'calendar', label: 'Calendario' }]} />
        <Button onClick={() => setForm({ open: true })}><Plus size={16} /> Nueva tarea</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1 sm:max-w-xs"><Search size={14} className="absolute left-3 top-3 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar o #etiqueta…" className="pl-8" aria-label="Buscar tareas" /></div>
        <Select value={project} onChange={(e) => setProject(e.target.value)} className="w-auto" aria-label="Filtrar por proyecto"><option value="">Todos los proyectos</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
        {view === 'list' && <label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Mostrar completadas</label>}
      </div>

      {view === 'list' && <ListView tasks={filtered} all={tasks} onEdit={(task) => setForm({ open: true, task })} onAddSub={(parentId) => setForm({ open: true, parentId })} />}
      {view === 'kanban' && <KanbanView tasks={filtered} onEdit={(task) => setForm({ open: true, task })} />}
      {view === 'calendar' && <TaskCalendarView tasks={filtered} onEdit={(task) => setForm({ open: true, task })} onCreate={(due) => setForm({ open: true, due })} />}

      <TaskForm open={form.open} onClose={close} task={form.task} parentId={form.parentId} defaultDue={form.due} projects={projects} />
    </div>
  );
}
