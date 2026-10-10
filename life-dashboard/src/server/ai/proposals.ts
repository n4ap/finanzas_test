import 'server-only';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import type { AIContext } from '../providers/types';
import { ServiceError, fail } from '../life/core';
import { toolByName } from './tools';

export const PROPOSAL_TTL_MS = 24 * 3_600_000;
export const MAX_PENDING = 30;

/**
 * Registra una acción propuesta. NO ejecuta nada: valida los argumentos con el esquema de la herramienta,
 * comprueba contra los datos del usuario que la acción tiene sentido (prepare) y espera su confirmación.
 */
export async function createProposal(ctx: AIContext, input: { tool: string; args: unknown; conversationId?: string | null; source?: 'assistant' | 'automation' }) {
  const tool = toolByName(input.tool);
  if (!tool || tool.kind !== 'write') return fail('Herramienta no permitida');
  const parsed = tool.schema.safeParse(input.args);
  if (!parsed.success) return fail(`Argumentos no válidos: ${parsed.error.issues[0]?.message ?? 'revisa los datos'}`);
  const pending = await db.aIProposal.count({ where: { userId: ctx.userId, status: 'pending', expiresAt: { gt: ctx.now } } });
  if (pending >= MAX_PENDING) return fail('Tienes demasiadas propuestas pendientes: confirma o descarta algunas');
  const summary = await tool.prepare!(ctx, parsed.data);
  const p = await db.aIProposal.create({
    data: { userId: ctx.userId, conversationId: input.conversationId ?? null, tool: tool.name, args: parsed.data as Prisma.InputJsonValue, summary, source: input.source ?? 'assistant', expiresAt: new Date(ctx.now.getTime() + PROPOSAL_TTL_MS) },
  });
  return { id: p.id, summary };
}

/**
 * Confirma y ejecuta. El paso pending→confirmed es atómico (updateMany condicional): dos clics o dos pestañas
 * ejecutan la acción UNA sola vez, y solo el dueño de la propuesta puede confirmarla.
 */
export async function confirmProposal(userId: string, id: string, tzOffset = 0, now = new Date()) {
  const claimed = await db.aIProposal.updateMany({ where: { id, userId, status: 'pending', expiresAt: { gt: now } }, data: { status: 'confirmed', resolvedAt: now } });
  if (claimed.count === 0) {
    const p = await db.aIProposal.findFirst({ where: { id, userId } });
    if (!p) return fail('Propuesta no encontrada');
    if (p.status === 'pending') return fail('La propuesta ha caducado: pídesela de nuevo al asistente');
    return fail(p.status === 'confirmed' ? 'Esta acción ya se ejecutó' : 'Esta propuesta ya no está pendiente');
  }
  const p = await db.aIProposal.findUniqueOrThrow({ where: { id } });
  const tool = toolByName(p.tool);
  try {
    if (!tool || tool.kind !== 'write') throw new ServiceError('Herramienta no permitida');
    const args = tool.schema.parse(p.args);
    const result = String(await tool.run({ userId, now, tzOffset }, args));
    await db.aIProposal.update({ where: { id }, data: { result } });
    return result;
  } catch (e) {
    const msg = e instanceof ServiceError ? e.message : 'No se pudo ejecutar la acción';
    await db.aIProposal.update({ where: { id }, data: { status: 'failed', result: msg } });
    if (!(e instanceof ServiceError)) console.error('[ai] fallo al ejecutar propuesta', p.tool, e);
    return fail(msg);
  }
}

export async function cancelProposal(userId: string, id: string, now = new Date()) {
  const r = await db.aIProposal.updateMany({ where: { id, userId, status: 'pending' }, data: { status: 'cancelled', resolvedAt: now } });
  if (r.count === 0) fail('Propuesta no encontrada o ya resuelta');
}

export async function listPending(userId: string, now = new Date()) {
  const rows = await db.aIProposal.findMany({ where: { userId, status: 'pending', expiresAt: { gt: now } }, orderBy: { createdAt: 'desc' }, take: 30 });
  return rows.map((p) => ({ id: p.id, summary: p.summary, source: p.source, createdAt: p.createdAt.toISOString() }));
}
