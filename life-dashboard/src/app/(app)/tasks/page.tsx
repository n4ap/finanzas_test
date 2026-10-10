import { TasksView } from '@/components/tasks/tasks-view';
import type { TaskDTO } from '@/components/tasks/types';
import type { TaskStatus } from '@/lib/tasks';
import { db } from '@/lib/db';
import { requireUser } from '@/server/auth';

export const metadata = { title: 'Tareas' };
export const dynamic = 'force-dynamic';

export default async function TasksPage() {
  const user = await requireUser();
  const [tasks, projects] = await Promise.all([
    db.task.findMany({ where: { userId: user.id }, include: { project: { select: { name: true, color: true } } }, orderBy: [{ priority: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }] }),
    db.project.findMany({ where: { userId: user.id }, select: { id: true, name: true, color: true }, orderBy: { name: 'asc' } }),
  ]);
  const dto: TaskDTO[] = tasks.map((t) => ({
    id: t.id, title: t.title, description: t.description, priority: t.priority, status: t.status as TaskStatus,
    dueDate: t.dueDate?.toISOString() ?? null, estimateMinutes: t.estimateMinutes, projectId: t.projectId, projectName: t.project?.name ?? null, projectColor: t.project?.color ?? null,
    parentId: t.parentId, tags: t.tags, recurrence: t.recurrence, remindAt: t.remindAt?.toISOString() ?? null, completedAt: t.completedAt?.toISOString() ?? null,
  }));
  return <TasksView tasks={dto} projects={projects} />;
}
