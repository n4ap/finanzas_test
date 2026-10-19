import 'server-only';
import { db } from '@/lib/db';
import { projectSchema } from '@/lib/validation-life';
import { LIMITS, fail, issue, toNoon } from './core';

const data = (p: ReturnType<typeof projectSchema.parse>) => ({
  name: p.name, description: p.description ?? null, status: p.status, priority: p.priority, color: p.color, targetDate: p.targetDate ? toNoon(p.targetDate) : null,
});

export async function createProject(userId: string, input: unknown) {
  const p = projectSchema.safeParse(input);
  if (!p.success) return fail(issue(p.error));
  if ((await db.project.count({ where: { userId } })) >= LIMITS.projects) return fail('Has alcanzado el máximo de proyectos');
  return (await db.project.create({ data: { userId, ...data(p.data) } })).id;
}

export async function updateProject(userId: string, id: string, input: unknown) {
  const p = projectSchema.safeParse(input);
  if (!p.success) return fail(issue(p.error));
  const r = await db.project.updateMany({ where: { id, userId }, data: data(p.data) });
  if (r.count === 0) fail('Proyecto no encontrado');
}

/** Borra el proyecto; sus tareas se conservan (quedan sin proyecto) para no perder trabajo por accidente. */
export async function deleteProject(userId: string, id: string) {
  const r = await db.project.deleteMany({ where: { id, userId } });
  if (r.count === 0) fail('Proyecto no encontrado');
}
