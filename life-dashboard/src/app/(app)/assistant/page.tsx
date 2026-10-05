import { AssistantView } from '@/components/assistant/assistant-view';
import { requireUser } from '@/server/auth';
import { getAssistantData } from '@/server/ai/queries';
import { getRecommendations } from '@/server/ai/recommendations';

export const metadata = { title: 'Asistente IA' };
export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<{ c?: string; q?: string }> }) {
  const { c, q } = await searchParams;
  const user = await requireUser();
  const d = await getAssistantData(user.id, c);
  const recommendations = d.current ? [] : await getRecommendations(user.id);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Asistente</h1>
      <AssistantView key={d.current ?? 'new'} d={d} recommendations={recommendations} initialQuery={typeof q === 'string' ? q.slice(0, 200) : undefined} />
    </div>
  );
}
