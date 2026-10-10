import 'server-only';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { decrypt, encrypt } from '@/lib/crypto';
import { fail, issue } from '../life/core';
import type { AIProvider } from '../providers/types';
import { createAnthropicProvider, DEFAULT_ANTHROPIC_MODEL, isAnthropicModel, pingAnthropic } from './anthropic-provider';
import { localProvider } from './local-provider';

interface AiPrefs { provider?: 'local' | 'anthropic'; consentAt?: string }
const keyAccount = (userId: string) => db.account.findFirst({ where: { userId, provider: 'anthropic', kind: 'ai' } });
const prefsOf = async (userId: string) => ((await db.user.findUnique({ where: { id: userId }, select: { preferences: true } }))?.preferences ?? {}) as { ai?: AiPrefs } & Record<string, unknown>;

export async function getAiSettings(userId: string) {
  const [prefs, acc] = await Promise.all([prefsOf(userId), keyAccount(userId)]);
  return {
    provider: prefs.ai?.provider === 'anthropic' && acc && prefs.ai.consentAt ? ('anthropic' as const) : ('local' as const),
    model: acc?.scope && isAnthropicModel(acc.scope) ? acc.scope : DEFAULT_ANTHROPIC_MODEL,
    hasKey: !!acc?.accessTokenEnc, keyHint: acc?.label ?? null, consentAt: prefs.ai?.consentAt ?? null,
  };
}

/** Proveedor del usuario: Claude solo si lo eligió, dio su clave y aceptó el envío de datos; si no, el asistente local. */
export async function resolveProvider(userId: string): Promise<AIProvider> {
  const s = await getAiSettings(userId);
  if (s.provider !== 'anthropic') return localProvider;
  const acc = await keyAccount(userId);
  if (!acc?.accessTokenEnc) return localProvider;
  return createAnthropicProvider({ apiKey: decrypt(acc.accessTokenEnc), model: s.model });
}

const schema = z.object({
  provider: z.enum(['local', 'anthropic']),
  apiKey: z.string().trim().min(20, 'La clave parece demasiado corta').max(300).regex(/^sk-ant-/, 'Las claves de Anthropic empiezan por «sk-ant-»').optional(),
  model: z.string().refine(isAnthropicModel, 'Modelo no disponible').default(DEFAULT_ANTHROPIC_MODEL),
  consent: z.boolean().default(false),
});

/** La clave se guarda CIFRADA (AES-256-GCM) y nunca vuelve al navegador: solo se muestra una pista con los últimos caracteres. */
export async function saveAiSettings(userId: string, input: unknown) {
  const p = schema.safeParse(input);
  if (!p.success) return fail(issue(p.error));
  const { provider, apiKey, model, consent } = p.data;
  const prefs = await prefsOf(userId);
  if (provider === 'local') {
    await db.user.update({ where: { id: userId }, data: { preferences: { ...prefs, ai: { provider: 'local' } } as Prisma.InputJsonValue } });
    return;
  }
  const existing = await keyAccount(userId);
  if (!apiKey && !existing) return fail('Introduce tu clave de API de Anthropic');
  if (!consent && !prefs.ai?.consentAt) return fail('Debes aceptar que tus datos se envíen a Anthropic para usar este proveedor');
  if (apiKey) await pingAnthropic(apiKey, model); // valida antes de guardar
  const enc = apiKey ? encrypt(apiKey) : existing!.accessTokenEnc!;
  const label = apiKey ? `…${apiKey.slice(-4)}` : existing!.label;
  if (existing) await db.account.update({ where: { id: existing.id }, data: { accessTokenEnc: enc, label, scope: model, status: 'connected', lastError: null } });
  else await db.account.create({ data: { userId, provider: 'anthropic', kind: 'ai', externalId: 'default', label, accessTokenEnc: enc, scope: model, status: 'connected' } });
  await db.user.update({ where: { id: userId }, data: { preferences: { ...prefs, ai: { provider: 'anthropic', consentAt: prefs.ai?.consentAt ?? new Date().toISOString() } } as Prisma.InputJsonValue } });
}

/** Borra la clave y vuelve al asistente local (también retira el consentimiento). */
export async function removeAiKey(userId: string) {
  const prefs = await prefsOf(userId);
  await db.account.deleteMany({ where: { userId, provider: 'anthropic', kind: 'ai' } });
  await db.user.update({ where: { id: userId }, data: { preferences: { ...prefs, ai: { provider: 'local' } } as Prisma.InputJsonValue } });
}
