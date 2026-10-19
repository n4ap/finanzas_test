import { notFound } from 'next/navigation';
import { ProjectDetail } from '@/components/projects/project-detail';
import { db } from '@/lib/db';
import { idSchema } from '@/lib/validation';
import { requireUser } from '@/server/auth';
import { listProjects, toTaskDTO } from '@/server/life/queries';

export const metadata = { title: 'Proyecto' };
export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  if (!idSchema.safeParse(id).success) notFound();
  const [projects, tasks] = await Promise.all([
    listProjects(user.id),
    db.task.findMany({ where: { userId: user.id, projectId: id }, include: { project: { select: { name: true, color: true } } }, orderBy: [{ priority: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }] }),
  ]);
  const project = projects.find((p) => p.id === id);
  if (!project) notFound();
  return <ProjectDetail project={project} tasks={tasks.map(toTaskDTO)} projects={projects.map((p) => ({ id: p.id, name: p.name, color: p.color }))} />;
}
