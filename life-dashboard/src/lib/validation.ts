import { z } from 'zod';
import { RECURRENCES, TASK_STATUSES } from './tasks';

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email no válido'),
  password: z.string().min(1, 'Introduce la contraseña').max(200),
});

export const registerSchema = loginSchema.extend({
  name: z.string().trim().min(1, 'Introduce tu nombre').max(80),
  password: z.string().min(10, 'Mínimo 10 caracteres').max(200),
});

export const layoutSchema = z.array(
  z.object({
    id: z.string().min(1).max(40),
    visible: z.boolean(),
    order: z.number().int().min(0).max(100),
    size: z.enum(['sm', 'md', 'lg']),
  }),
).max(40);

export type LoginInput = z.infer<typeof loginSchema>;

// ───────────── Fase 2 ─────────────

const emptyToUndef = (v: unknown) => (v === '' || v === null ? undefined : v);
const optId = z.preprocess(emptyToUndef, z.string().cuid().optional());

export const taskSchema = z.object({
  title: z.string().trim().min(1, 'El título es obligatorio').max(200),
  description: z.string().trim().max(2000).optional(),
  priority: z.coerce.number().int().min(1).max(3).default(2),
  status: z.enum(TASK_STATUSES).default('inbox'),
  dueDate: z.preprocess(emptyToUndef, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha no válida').optional()),
  estimateMinutes: z.preprocess(emptyToUndef, z.coerce.number().int().min(1).max(1440).optional()),
  projectId: optId,
  parentId: optId,
  tags: z.array(z.string().max(30)).max(10).default([]),
  recurrence: z.preprocess(emptyToUndef, z.enum(RECURRENCES).optional()),
  remindAt: z.preprocess(emptyToUndef, z.string().datetime({ offset: true }).optional()),
});
export type TaskInput = z.input<typeof taskSchema>;

export const eventSchema = z
  .object({
    calendarId: z.string().cuid(),
    title: z.string().trim().min(1, 'El título es obligatorio').max(200),
    description: z.string().trim().max(2000).optional(),
    location: z.string().trim().max(200).optional(),
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }),
    allDay: z.boolean().default(false),
    attendees: z.array(z.string().trim().max(120)).max(30).default([]),
    important: z.boolean().default(false),
  })
  .refine((e) => new Date(e.endsAt) >= new Date(e.startsAt), { message: 'El fin no puede ser anterior al inicio', path: ['endsAt'] });
export type EventInput = z.input<typeof eventSchema>;

export const calendarSchema = z.object({
  name: z.string().trim().min(1, 'Nombre obligatorio').max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#6366f1'),
});

export const idSchema = z.string().cuid();
