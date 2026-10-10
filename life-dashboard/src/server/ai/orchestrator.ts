import 'server-only';
import { db } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import { registry } from '../providers/registry';
import type { AIContext, AIMessageDTO, AIProvider, AIToolCall } from '../providers/types';
import { ServiceError, fail } from '../life/core';
import { localProvider } from './local-provider';
import { createProposal } from './proposals';
import { z } from 'zod';
import { resolveProvider } from './provider-config';
import { TOOLS, toolByName } from './tools';

export const MAX_INPUT = 1000;
export const MAX_STEPS = 4;
export const MAX_MESSAGES = 200;
const MAX_TOOL_RESULT = 8000;

registry.ai.set(localProvider.id, localProvider);

export interface ChatTurn { conversationId: string; reply: string; proposals: string[] }

/** JSON Schema de los argumentos de una herramienta (para proveedores con tool use nativo). */
const inputSchemaOf = (schema: z.ZodType): Record<string, unknown> => { const { $schema, ...rest } = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as Record<string, unknown>; void $schema; return rest; };

const clipJson = (v: unknown) => { const s = JSON.stringify(v); return s.length > MAX_TOOL_RESULT ? JSON.stringify({ truncated: true, preview: s.slice(0, MAX_TOOL_RESULT) }) : s; };

/**
 * Un turno de conversación. Bucle acotado (MAX_STEPS): el proveedor pide herramientas → se ejecutan acotadas al usuario
 * (lectura: datos; escritura: SOLO una propuesta pendiente) → el proveedor redacta. Nada de lo que devuelve un proveedor
 * puede modificar datos sin la confirmación explícita del usuario.
 */
export async function chat(ctx: AIContext, input: { conversationId?: string | null; text: string }, injected?: AIProvider): Promise<ChatTurn> {
  const provider = injected ?? (await resolveProvider(ctx.userId));
  const text = input.text.trim();
  if (!text) return fail('Escribe un mensaje');
  if (text.length > MAX_INPUT) return fail(`El mensaje es demasiado largo (máximo ${MAX_INPUT} caracteres)`);

  let conv = input.conversationId ? await db.aIConversation.findFirst({ where: { id: input.conversationId, userId: ctx.userId } }) : null;
  if (input.conversationId && !conv) return fail('Conversación no encontrada');
  if (conv && (await db.aIMessage.count({ where: { conversationId: conv.id } })) >= MAX_MESSAGES) return fail('La conversación es muy larga: empieza una nueva');
  conv ??= await db.aIConversation.create({ data: { userId: ctx.userId, title: text.slice(0, 60) } });
  const conversationId = conv.id;

  await db.aIMessage.create({ data: { conversationId, role: 'user', content: text } });
  const stored = await db.aIMessage.findMany({ where: { conversationId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 24 });
  const history: AIMessageDTO[] = stored.reverse().map((m) => {
    const tc = m.toolCalls as { calls?: AIToolCall[]; toolCallId?: string; toolName?: string } | null;
    return { role: m.role as AIMessageDTO['role'], content: m.content, toolCalls: tc?.calls, toolCallId: tc?.toolCallId, toolName: tc?.toolName };
  });
  // La ventana puede empezar a mitad de un turno anterior: se descartan mensajes de herramienta huérfanos.
  while (history[0] && history[0].role !== 'user') history.shift();

  const toolInfos = TOOLS.map((t) => ({ name: t.name, description: t.description, kind: t.kind, inputSchema: inputSchemaOf(t.schema) }));
  const proposals: string[] = [];
  let reply = '';
  for (let step = 0; step < MAX_STEPS; step++) {
    const out = await provider.respond({ ctx, history, tools: toolInfos });
    if (out.toolCalls.length === 0) { reply = out.content || 'No tengo nada que añadir.'; break; }
    const calls = out.toolCalls.slice(0, 6);
    history.push({ role: 'assistant', content: out.content, toolCalls: calls, raw: out.raw });
    await db.aIMessage.create({ data: { conversationId, role: 'assistant', content: out.content, toolCalls: { calls } as unknown as Prisma.InputJsonValue } });
    for (const c of calls) {
      const result = await runCall(ctx, conversationId, c, proposals);
      const content = clipJson(result);
      history.push({ role: 'tool', content, toolCallId: c.id, toolName: c.name });
      await db.aIMessage.create({ data: { conversationId, role: 'tool', content, toolCalls: { toolCallId: c.id, toolName: c.name } } });
    }
    if (step === MAX_STEPS - 1) reply = 'He hecho lo que he podido con los datos disponibles.';
  }
  await db.aIMessage.create({ data: { conversationId, role: 'assistant', content: reply, toolCalls: proposals.length ? { proposals } : undefined } });
  await db.aIConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
  return { conversationId, reply, proposals };
}

/** Ejecuta una llamada del proveedor con todas las salvaguardas. Los errores vuelven como resultado, nunca rompen el turno. */
async function runCall(ctx: AIContext, conversationId: string, c: AIToolCall, proposals: string[]): Promise<unknown> {
  const tool = toolByName(c.name);
  if (!tool) return { error: `Herramienta desconocida: ${c.name.slice(0, 40)}` };
  const parsed = tool.schema.safeParse(c.args ?? {});
  if (!parsed.success) return { error: `Argumentos no válidos: ${parsed.error.issues[0]?.message ?? 'revisa los datos'}` };
  try {
    if (tool.kind === 'read') return await tool.run(ctx, parsed.data);
    const p = await createProposal(ctx, { tool: tool.name, args: parsed.data, conversationId });
    proposals.push(p.id);
    return { status: 'pending_confirmation', proposalId: p.id, summary: p.summary, note: 'No ejecutada: el usuario debe confirmarla.' };
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    console.error('[ai] fallo en herramienta', c.name, e);
    return { error: 'Error interno al ejecutar la herramienta' };
  }
}
