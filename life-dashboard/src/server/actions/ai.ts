'use server';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { clampOffset } from '@/lib/tz';
import { idSchema } from '@/lib/validation';
import { requireUser } from '../auth';
import { chat } from '../ai/orchestrator';
import { cancelProposal, confirmProposal } from '../ai/proposals';
import { run } from '../finance/service';
import { fail, type ActionResult } from './result';

const refreshAll = () => { for (const p of ['/assistant', '/automations', '/tasks', '/calendar', '/family', '/dashboard']) revalidatePath(p); };

export async function sendMessageAction(input: { conversationId?: string | null; text: string; tzOffset?: number }): Promise<ActionResult<{ conversationId: string }>> {
  const user = await requireUser();
  if (!rateLimit(`ai:${user.id}`, 20, 60_000).ok) return fail('Demasiados mensajes seguidos. Espera un momento.');
  const convId = input.conversationId ? (idSchema.safeParse(input.conversationId).success ? input.conversationId : null) : null;
  if (input.conversationId && !convId) return fail('Conversación no válida');
  const r = await run(() => chat({ userId: user.id, now: new Date(), tzOffset: clampOffset(input.tzOffset) }, { conversationId: convId, text: String(input.text ?? '') }));
  if (!r.ok) return r;
  revalidatePath('/assistant');
  return { ok: true, data: { conversationId: r.data.conversationId } };
}

export async function confirmProposalAction(id: string, tzOffset?: number): Promise<ActionResult<string>> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success) return fail('Propuesta no válida');
  const r = await run(() => confirmProposal(user.id, id, clampOffset(tzOffset)));
  if (r.ok) refreshAll();
  return r.ok ? { ok: true, data: r.data } : r;
}

export async function cancelProposalAction(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success) return fail('Propuesta no válida');
  const r = await run(() => cancelProposal(user.id, id));
  if (r.ok) refreshAll();
  return r.ok ? { ok: true } : r;
}

export async function deleteConversationAction(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success) return fail('Conversación no válida');
  const r = await db.aIConversation.deleteMany({ where: { id, userId: user.id } });
  if (r.count === 0) return fail('Conversación no encontrada');
  revalidatePath('/assistant');
  return { ok: true };
}
