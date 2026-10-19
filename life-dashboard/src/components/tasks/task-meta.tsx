import { CalendarDays, Clock, Repeat } from 'lucide-react';
import { Badge } from '@/components/ui/primitives';
import { PRIORITY_LABEL, RECURRENCE_LABEL, type Recurrence } from '@/lib/tasks';
import type { TaskDTO } from './types';

const pad = (n: number) => String(n).padStart(2, '0');
export const localDateKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function isTaskOverdue(t: TaskDTO, now = new Date()) {
  return t.status !== 'done' && !!t.dueDate && t.dueDate.slice(0, 10) < localDateKey(now);
}

export function TaskMeta({ task }: { task: TaskDTO }) {
  const overdue = isTaskOverdue(task);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge tone={task.priority === 1 ? 'urgent' : task.priority === 2 ? 'important' : 'neutral'}>{PRIORITY_LABEL[task.priority]}</Badge>
      {task.dueDate && (
        <Badge tone={overdue ? 'urgent' : 'neutral'}><CalendarDays size={11} />{new Date(task.dueDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' })}{overdue && ' · atrasada'}</Badge>
      )}
      {task.estimateMinutes && <Badge><Clock size={11} />{task.estimateMinutes} min</Badge>}
      {task.recurrence && <Badge tone="primary"><Repeat size={11} />{RECURRENCE_LABEL[task.recurrence as Recurrence]}</Badge>}
      {task.projectName && <Badge><span className="h-1.5 w-1.5 rounded-full" style={{ background: task.projectColor ?? undefined }} />{task.projectName}</Badge>}
      {task.tags.map((t) => <Badge key={t}>#{t}</Badge>)}
    </div>
  );
}
