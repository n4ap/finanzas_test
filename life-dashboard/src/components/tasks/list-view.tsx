'use client';
import { Check, Plus } from 'lucide-react';
import { useTransition } from 'react';
import { Button, EmptyState } from '@/components/ui/primitives';
import { STATUS_LABEL, TASK_STATUSES, type TaskStatus } from '@/lib/tasks';
import { cn } from '@/lib/utils';
import { setTaskStatus } from '@/server/actions/tasks';
import { TaskMeta } from './task-meta';
import type { TaskDTO } from './types';

export function TaskCheck({ task }: { task: TaskDTO }) {
  const [pending, start] = useTransition();
  const done = task.status === 'done';
  return (
    <button aria-label={done ? `Reabrir «${task.title}»` : `Completar «${task.title}»`} aria-pressed={done} disabled={pending}
      onClick={(e) => { e.stopPropagation(); start(async () => { await setTaskStatus(task.id, done ? 'next' : 'done'); }); }}
      className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors', done ? 'border-success bg-success text-white' : 'border-muted-foreground/40 hover:border-primary', pending && 'opacity-50')}>
      {done && <Check size={12} strokeWidth={3} />}
    </button>
  );
}

function Row({ task, subtasks, onEdit, onAddSub }: { task: TaskDTO; subtasks: TaskDTO[]; onEdit: (t: TaskDTO) => void; onAddSub: (parentId: string) => void }) {
  const doneSubs = subtasks.filter((s) => s.status === 'done').length;
  return (
    <li className="py-2">
      <div className="flex gap-3">
        <TaskCheck task={task} />
        <div className="min-w-0 flex-1">
          <button onClick={() => onEdit(task)} className={cn('block w-full text-left text-sm font-medium hover:text-primary', task.status === 'done' && 'text-muted-foreground line-through')}>{task.title}</button>
          <div className="mt-1"><TaskMeta task={task} /></div>
          {subtasks.length > 0 && <p className="mt-1 text-xs text-muted-foreground">{doneSubs}/{subtasks.length} subtareas</p>}
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => onAddSub(task.id)} aria-label={`Añadir subtarea a «${task.title}»`}><Plus size={14} /></Button>
      </div>
      {subtasks.length > 0 && (
        <ul className="ml-8 mt-1 border-l pl-3">
          {subtasks.map((s) => (
            <li key={s.id} className="flex items-center gap-2 py-1">
              <TaskCheck task={s} />
              <button onClick={() => onEdit(s)} className={cn('text-left text-sm hover:text-primary', s.status === 'done' && 'text-muted-foreground line-through')}>{s.title}</button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function ListView({ tasks, all, onEdit, onAddSub }: { tasks: TaskDTO[]; all: TaskDTO[]; onEdit: (t: TaskDTO) => void; onAddSub: (parentId: string) => void }) {
  const roots = tasks.filter((t) => !t.parentId);
  if (roots.length === 0) return <EmptyState title="Sin tareas" hint="Crea una con «Nueva tarea» o cambia los filtros." />;
  return (
    <div className="space-y-5">
      {TASK_STATUSES.map((status: TaskStatus) => {
        const rows = roots.filter((t) => t.status === status);
        if (rows.length === 0) return null;
        return (
          <section key={status} aria-label={STATUS_LABEL[status]}>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{STATUS_LABEL[status]} · {rows.length}</h3>
            <ul className="divide-y rounded-2xl border bg-card px-4">
              {rows.map((t) => <Row key={t.id} task={t} subtasks={all.filter((s) => s.parentId === t.id)} onEdit={onEdit} onAddSub={onAddSub} />)}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
