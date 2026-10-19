import 'server-only';
import { db } from '@/lib/db';
import { idSchema } from '@/lib/validation';
import { listPending } from './proposals';

export interface ProposalDTO { id: string; summary: string; status: string; result: string | null; expired: boolean }
export interface ChatMessageDTO { id: string; role: 'user' | 'assistant'; content: string; proposals: ProposalDTO[] }

/** Datos de /assistant: conversaciones, el hilo elegido (solo mensajes visibles) y propuestas pendientes. Todo acotado al usuario. */
export async function getAssistantData(userId: string, conversationId: string | undefined, now = new Date()) {
  const [conversations, pending] = await Promise.all([
    db.aIConversation.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' }, take: 30, select: { id: true, title: true, updatedAt: true } }),
    listPending(userId, now),
  ]);
  let messages: ChatMessageDTO[] = [];
  let current: string | null = null;
  if (conversationId && idSchema.safeParse(conversationId).success && conversations.some((c) => c.id === conversationId)) {
    current = conversationId;
    const rows = await db.aIMessage.findMany({ where: { conversationId, conversation: { userId } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    const visible = rows.filter((m) => m.role === 'user' || (m.role === 'assistant' && m.content !== '' && !(m.toolCalls as { calls?: unknown } | null)?.calls));
    const ids = visible.flatMap((m) => ((m.toolCalls as { proposals?: string[] } | null)?.proposals ?? []));
    const props = ids.length ? await db.aIProposal.findMany({ where: { id: { in: ids }, userId } }) : [];
    messages = visible.map((m) => ({
      id: m.id, role: m.role as 'user' | 'assistant', content: m.content,
      proposals: ((m.toolCalls as { proposals?: string[] } | null)?.proposals ?? []).flatMap((pid) => {
        const p = props.find((x) => x.id === pid);
        return p ? [{ id: p.id, summary: p.summary, status: p.status, result: p.result, expired: p.status === 'pending' && p.expiresAt <= now }] : [];
      }),
    }));
  }
  return { conversations: conversations.map((c) => ({ id: c.id, title: c.title })), current, messages, pending };
}
export type AssistantData = Awaited<ReturnType<typeof getAssistantData>>;
