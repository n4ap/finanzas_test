import { z } from 'zod';
import { ACTION_TYPES, TRIGGER_TYPES, type ActionType, type TriggerType } from './automations';

const days = (d: number) => z.coerce.number().int().min(1).max(30).default(d);
export const triggerConfigSchemas = {
  task_overdue: z.object({}),
  budget_alert: z.object({ threshold: z.coerce.number().refine((n) => n === 80 || n === 100, 'El umbral es 80 o 100').default(100) }),
  birthday_soon: z.object({ days: days(7) }),
  email_needs_reply: z.object({ days: days(2) }),
  trip_soon: z.object({ days: days(7) }),
  weekly: z.object({ weekday: z.coerce.number().int().min(1).max(7).default(1) }),
} satisfies Record<TriggerType, z.ZodType>;
export const actionConfigSchemas = {
  notify: z.object({}),
  create_task: z.object({ titleTemplate: z.string().trim().min(1, 'Escribe el título de la tarea').max(150).default('Revisar: {subject}') }),
  digest: z.object({}),
} satisfies Record<ActionType, z.ZodType>;

export const automationSchema = z.object({
  name: z.string().trim().min(1, 'Ponle un nombre').max(80),
  triggerType: z.enum(TRIGGER_TYPES),
  triggerConfig: z.record(z.string(), z.unknown()).default({}),
  actionType: z.enum(ACTION_TYPES),
  actionConfig: z.record(z.string(), z.unknown()).default({}),
  requiresConfirmation: z.boolean().default(true),
  enabled: z.boolean().default(true),
}).transform((a, ctx) => {
  const t = triggerConfigSchemas[a.triggerType].safeParse(a.triggerConfig);
  if (!t.success) { ctx.addIssue({ code: 'custom', path: ['triggerConfig'], message: t.error.issues[0]?.message ?? 'Configuración no válida' }); return z.NEVER; }
  const c = actionConfigSchemas[a.actionType].safeParse(a.actionConfig);
  if (!c.success) { ctx.addIssue({ code: 'custom', path: ['actionConfig'], message: c.error.issues[0]?.message ?? 'Configuración no válida' }); return z.NEVER; }
  if (a.actionType === 'digest' && a.triggerType !== 'weekly') { ctx.addIssue({ code: 'custom', message: 'El resumen solo se puede programar con «llega cierto día de la semana»' }); return z.NEVER; }
  return { ...a, triggerConfig: t.data as Record<string, unknown>, actionConfig: c.data as Record<string, unknown> };
});
export type AutomationInput = z.input<typeof automationSchema>;

