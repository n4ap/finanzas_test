import 'server-only';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { automationSchema } from '@/lib/automation-schema';
import { fail, issue } from '../life/core';

export const MAX_AUTOMATIONS = 20;

const data = (a: ReturnType<typeof automationSchema.parse>) => ({
  name: a.name, triggerType: a.triggerType, triggerConfig: a.triggerConfig as Prisma.InputJsonValue, actionType: a.actionType,
  actionConfig: a.actionConfig as Prisma.InputJsonValue, requiresConfirmation: a.requiresConfirmation, enabled: a.enabled,
});

export async function createAutomation(userId: string, input: unknown) {
  const p = automationSchema.safeParse(input);
  if (!p.success) return fail(issue(p.error));
  if ((await db.automation.count({ where: { userId } })) >= MAX_AUTOMATIONS) return fail(`Has alcanzado el máximo de ${MAX_AUTOMATIONS} automatizaciones`);
  return (await db.automation.create({ data: { userId, ...data(p.data) } })).id;
}

export async function updateAutomation(userId: string, id: string, input: unknown) {
  const p = automationSchema.safeParse(input);
  if (!p.success) return fail(issue(p.error));
  // Cambiar la regla reinicia su memoria de disparos: es otra regla.
  const r = await db.automation.updateMany({ where: { id, userId }, data: data(p.data) });
  if (r.count === 0) return fail('Automatización no encontrada');
  await db.automationRun.deleteMany({ where: { automationId: id } });
}

export async function setAutomationEnabled(userId: string, id: string, enabled: boolean) {
  const r = await db.automation.updateMany({ where: { id, userId }, data: { enabled } });
  if (r.count === 0) fail('Automatización no encontrada');
}

export async function deleteAutomation(userId: string, id: string) {
  const r = await db.automation.deleteMany({ where: { id, userId } });
  if (r.count === 0) fail('Automatización no encontrada');
}
