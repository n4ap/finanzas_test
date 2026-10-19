import { ProjectsView } from '@/components/projects/projects-view';
import { requireUser } from '@/server/auth';
import { listProjects } from '@/server/life/queries';

export const metadata = { title: 'Proyectos' };
export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await requireUser();
  return <ProjectsView projects={await listProjects(user.id)} />;
}
