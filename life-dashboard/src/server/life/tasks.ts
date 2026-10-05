import 'server-only';
import { db } from '@/lib/db';
import { nextOccurrence, TASK_STATUSES, type Recurrence, type TaskStatus } from '@/lib/tasks';
import { fail } from './core';

/**
 * Cambia el estado de una tarea del usuario (Kanban, checkbox, asistente).
 * Al completar una recurrente se crea la siguiente ocurrencia; completar la padre completa sus subtareas.
 */
export async function setTaskStatusFor(userId: string, id: string, status: TaskStatus) {
  if (!TASK_STATUSES.includes(status)) return fail('Datos no válidos');
  const t = (await db.task.findFirst({ where: { id, userId } })) ?? fail('Tarea no encontrada');
  if (t.status === status) return t;
  const completing = status === 'done';
  await db.$transaction(async (tx) => {
    await tx.task.update({ where: { id }, data: { status, completedAt: completing ? new Date() : null } });
    if (completing && t.recurrence && t.dueDate && !t.parentId) {
      const next = nextOccurrence(t.dueDate, t.recurrence as Recurrence);
      await tx.task.create({
        data: {
          userId, title: t.title, description: t.description, priority: t.priority, status: 'next', estimateMinutes: t.estimateMinutes,
          projectId: t.projectId, tags: t.tags, recurrence: t.recurrence, dueDate: next,
          remindAt: t.remindAt ? new Date(next.getTime() - (t.dueDate.getTime() - t.remindAt.getTime())) : null,
        },
      });
    }
    if (completing && !t.parentId) await tx.task.updateMany({ where: { parentId: id, status: { not: 'done' } }, data: { status: 'done', completedAt: new Date() } });
  });
  return t;
}
