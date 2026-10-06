import { z } from 'zod';
import { ALL_QUESTIONS, DAILY_QUESTIONS, GOAL_AREAS, GOAL_LEVELS, MONTHLY_QUESTIONS, SCORE_AREAS, WEEKLY_QUESTIONS } from './coach';

const opt = (max: number) => z.string().trim().max(max).nullish().transform((v) => v || null);
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha no válida');
const QUESTION_KEYS = new Set(ALL_QUESTIONS.map((q) => q.key));

/** Respuestas de la entrevista: solo claves conocidas; vacío = borrar la respuesta. */
export const answersSchema = z.object({
  answers: z.record(z.string(), z.string().max(2000)).refine((a) => Object.keys(a).every((k) => QUESTION_KEYS.has(k)), 'Pregunta desconocida').refine((a) => Object.keys(a).length <= 20, 'Demasiadas respuestas a la vez'),
});

export const goalSchema = z.object({
  level: z.enum(GOAL_LEVELS.map((l) => l.id) as [string, ...string[]]),
  area: z.enum(GOAL_AREAS.map((a) => a.id) as [string, ...string[]]),
  title: z.string().trim().min(3, 'Escribe el objetivo').max(160),
  why: opt(500), metric: opt(200), baseline: opt(200), target: opt(200),
  progress: z.coerce.number().int().min(0).max(100).default(0),
  dueDate: dateKey.optional().or(z.literal('')).transform((v) => v || null),
  nextAction: opt(200), obstacles: opt(500), planB: opt(500),
  parentId: z.string().cuid().optional().or(z.literal('')).transform((v) => v || null),
  status: z.enum(['active', 'done', 'dropped']).default('active'),
});
export type GoalInput = z.output<typeof goalSchema>;

const score = z.coerce.number().int().min(0).max(10);
const oneToTen = z.coerce.number().int().min(1).max(10).optional().nullable();
const textMap = (keys: readonly { key: string }[]) => z.object(Object.fromEntries(keys.map((q) => [q.key, z.string().trim().max(2000).optional()]))).strict();

export const reviewSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('daily'), period: dateKey, answers: textMap(DAILY_QUESTIONS), energy: oneToTen, mood: oneToTen, stress: oneToTen }),
  z.object({ kind: z.literal('weekly'), period: dateKey, answers: textMap(WEEKLY_QUESTIONS), scores: z.object(Object.fromEntries(SCORE_AREAS.map((a) => [a.id, score.optional()]))).strict() }),
  z.object({ kind: z.literal('monthly'), period: z.string().regex(/^\d{4}-\d{2}$/, 'Mes no válido'), answers: textMap(MONTHLY_QUESTIONS) }),
]);
export type ReviewInput = z.output<typeof reviewSchema>;

const optionSchema = z.object({
  name: z.string().trim().min(1, 'Nombra la opción').max(120),
  pros: opt(800), cons: opt(800), risks: opt(800), cost: opt(400),
});
export const decisionSchema = z.object({
  title: z.string().trim().min(3, 'Describe la decisión').max(160),
  objective: opt(500),
  options: z.array(optionSchema).min(1, 'Añade al menos una opción').max(6),
  impact: opt(800), recommendation: opt(1500), nextAction: opt(200),
  status: z.enum(['open', 'decided']).default('open'),
  chosen: opt(120),
});
export type DecisionInput = z.output<typeof decisionSchema>;
