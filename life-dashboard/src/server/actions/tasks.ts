'use server';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { dateOnlyToDate, nextOccurrence, TASK_STATUSES, type Recurrence, type TaskStatus } from '@/lib/tasks';
import { idSchema, taskSchema } from '@/lib/validation';
import { requireUser } from '../auth';
import { fail, firstIssue, type ActionResult } from './result';

const refresh = () => { revalidatePath('/tasks'); revalidatePath('/dashboard'); revalidatePath('/projects'); };

/** Verifica que proyecto y tarea padre pertenecen al usuario (evita referenciar datos ajenos). */
async function checkRefs(userId: string, projectId?: string, parentId?: string) {
  if (projectId && !(await db.project.findFirst({ where: { id: projectId, userId }, select: { id: true } }))) return 'Proyecto no válido';
  if (parentId && !(await db.task.findFirst({ where: { id: parentId, userId, parentId: null }, select: { id: true } }))) return 'Tarea padre no válida';
  return null;
}

export async function createTask(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const p = taskSchema.safeParse(input);
  if (!p.success) return fail(firstIssue(p.error));
  const d = p.data;
  const refErr = await checkRefs(user.id, d.projectId, d.parentId);
  if (refErr) return fail(refErr);
  await db.task.create({
    data: {
      userId: user.id, title: d.title, description: d.description, priority: d.priority, status: d.status,
      dueDate: d.dueDate ? dateOnlyToDate(d.dueDate) : null, estimateMinutes: d.estimateMinutes, projectId: d.projectId, parentId: d.parentId,
      tags: d.tags, recurrence: d.recurrence, remindAt: d.remindAt ? new Date(d.remindAt) : null, completedAt: d.status === 'done' ? new Date() : null,
    },
  });
  refresh();
  return { ok: true };
}

export async function updateTask(id: string, input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success) return fail('Tarea no válida');
  const p = taskSchema.safeParse(input);
  if (!p.success) return fail(firstIssue(p.error));
  const d = p.data;
  const current = await db.task.findFirst({ where: { id, userId: user.id } });
  if (!current) return fail('Tarea no encontrada');
  const refErr = await checkRefs(user.id, d.projectId, undefined);
  if (refErr) return fail(refErr);
  await db.task.update({
    where: { id },
    data: {
      title: d.title, description: d.description ?? null, priority: d.priority, status: d.status,
      dueDate: d.dueDate ? dateOnlyToDate(d.dueDate) : null, estimateMinutes: d.estimateMinutes ?? null, projectId: d.projectId ?? null,
      tags: d.tags, recurrence: d.recurrence ?? null, remindAt: d.remindAt ? new Date(d.remindAt) : null,
      completedAt: d.status === 'done' ? (current.completedAt ?? new Date()) : null,
    },
  });
  refresh();
  return { ok: true };
}

/** Cambia el estado (Kanban, checkbox). Al completar una recurrente se crea la siguiente ocurrencia. */
export async function setTaskStatus(id: string, status: TaskStatus): Promise<ActionResult> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success || !TASK_STATUSES.includes(status)) return fail('Datos no válidos');
  const t = await db.task.findFirst({ where: { id, userId: user.id } });
  if (!t) return fail('Tarea no encontrada');
  if (t.status === status) return { ok: true };
  const completing = status === 'done';
  await db.$transaction(async (tx) => {
    await tx.task.update({ where: { id }, data: { status, completedAt: completing ? new Date() : null } });
    if (completing && t.recurrence && t.dueDate && !t.parentId) {
      await tx.task.create({
        data: {
          userId: user.id, title: t.title, description: t.description, priority: t.priority, status: 'next', estimateMinutes: t.estimateMinutes,
          projectId: t.projectId, tags: t.tags, recurrence: t.recurrence, dueDate: nextOccurrence(t.dueDate, t.recurrence as Recurrence),
          remindAt: t.remindAt && t.dueDate ? new Date(nextOccurrence(t.dueDate, t.recurrence as Recurrence).getTime() - (t.dueDate.getTime() - t.remindAt.getTime())) : null,
        },
      });
    }
    // Completar la tarea padre completa sus subtareas abiertas.
    if (completing && !t.parentId) await tx.task.updateMany({ where: { parentId: id, status: { not: 'done' } }, data: { status: 'done', completedAt: new Date() } });
  });
  refresh();
  return { ok: true };
}

export async function deleteTask(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success) return fail('Tarea no válida');
  const r = await db.task.deleteMany({ where: { id, userId: user.id } });
  if (r.count === 0) return fail('Tarea no encontrada');
  refresh();
  return { ok: true };
}
