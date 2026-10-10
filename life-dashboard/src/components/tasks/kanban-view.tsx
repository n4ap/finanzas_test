'use client';
import { useRef, useState, useTransition } from 'react';
import { Select } from '@/components/ui/primitives';
import { STATUS_LABEL, TASK_STATUSES, type TaskStatus } from '@/lib/tasks';
import { cn } from '@/lib/utils';
import { setTaskStatus } from '@/server/actions/tasks';
import { TaskMeta } from './task-meta';
import type { TaskDTO } from './types';

export function KanbanView({ tasks, onEdit }: { tasks: TaskDTO[]; onEdit: (t: TaskDTO) => void }) {
  const roots = tasks.filter((t) => !t.parentId);
  const drag = useRef<string | null>(null);
  const [over, setOver] = useState<TaskStatus | null>(null);
  const [, start] = useTransition();
  const move = (id: string, status: TaskStatus) => start(async () => { await setTaskStatus(id, status); });

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 lg:grid lg:grid-cols-5 lg:overflow-visible">
      {TASK_STATUSES.map((status) => {
        const col = roots.filter((t) => t.status === status);
        return (
          <section key={status} aria-label={STATUS_LABEL[status]}
            onDragOver={(e) => { e.preventDefault(); setOver(status); }} onDragLeave={() => setOver(null)}
            onDrop={() => { setOver(null); if (drag.current) move(drag.current, status); drag.current = null; }}
            className={cn('w-72 shrink-0 rounded-2xl border bg-muted/40 p-2 lg:w-auto', over === status && 'ring-2 ring-primary/50')}>
            <h3 className="mb-2 flex items-center justify-between px-2 pt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{STATUS_LABEL[status]}<span className="rounded-full bg-muted px-2 py-0.5">{col.length}</span></h3>
            <ul className="space-y-2">
              {col.map((t) => (
                <li key={t.id} draggable onDragStart={() => { drag.current = t.id; }} className="cursor-grab rounded-xl border bg-card p-3 shadow-sm active:cursor-grabbing">
                  <button onClick={() => onEdit(t)} className="mb-2 block w-full text-left text-sm font-medium hover:text-primary">{t.title}</button>
                  <TaskMeta task={t} />
                  <Select aria-label={`Mover «${t.title}»`} value={t.status} onChange={(e) => move(t.id, e.target.value as TaskStatus)} className="mt-2 h-8 text-xs">
                    {TASK_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                  </Select>
                </li>
              ))}
              {col.length === 0 && <li className="px-2 py-4 text-center text-xs text-muted-foreground">Vacío</li>}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
