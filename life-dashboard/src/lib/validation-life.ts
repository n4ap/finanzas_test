import { z } from 'zod';
import { GOAL_KINDS, GOAL_META, METRIC_KINDS, METRIC_META, WORKOUT_KINDS } from './health';
import { PROJECT_STATUSES } from './projects';
import { BOOKING_KINDS, MAX_TRIP_DAYS } from './travel';

const emptyToUndef = (v: unknown) => (v === '' || v === null ? undefined : v);
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha no válida').refine((s) => !Number.isNaN(Date.parse(`${s}T12:00:00Z`)) && new Date(`${s}T12:00:00Z`).toISOString().startsWith(s), 'Fecha no válida');
const optDate = z.preprocess(emptyToUndef, dateOnly.optional());
const optText = (max: number) => z.preprocess(emptyToUndef, z.string().trim().max(max).optional());
const optNumber = (min: number, max: number) => z.preprocess(emptyToUndef, z.coerce.number().min(min).max(max).optional());
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color no válido');

// ── Proyectos
export const projectSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(80),
  description: optText(500),
  status: z.enum(PROJECT_STATUSES).default('active'),
  priority: z.coerce.number().int().min(1).max(3).default(2),
  color: color.default('#6366f1'),
  targetDate: optDate,
});
export type ProjectInput = z.input<typeof projectSchema>;

// ── Salud
export const metricSchema = z.object({
  kind: z.enum(METRIC_KINDS),
  date: dateOnly,
  value: z.coerce.number().finite(),
}).superRefine((m, ctx) => {
  const { min, max, label } = METRIC_META[m.kind];
  if (m.value < min || m.value > max) ctx.addIssue({ code: 'custom', path: ['value'], message: `${label}: valor fuera de rango (${min}–${max})` });
});
export type MetricInput = z.input<typeof metricSchema>;

/** Importación de pasos y sueño (Garmin): máximo 2 años de días, sin repetir tipo y día. */
export const healthImportSchema = z.object({
  rows: z.array(z.object({ kind: z.enum(['steps', 'sleep']), date: dateOnly, value: z.number().finite() }).superRefine((m, ctx) => {
    const { min, max, label } = METRIC_META[m.kind];
    if (m.value <= min || m.value > max) ctx.addIssue({ code: 'custom', path: ['value'], message: `${label}: valor fuera de rango (${m.date})` });
  })).min(1, 'No hay datos que importar').max(1500, 'Demasiados días de golpe: importa como mucho 2 años'),
}).refine((d) => new Set(d.rows.map((r) => `${r.kind}|${r.date}`)).size === d.rows.length, 'Hay días repetidos en el archivo');

export const workoutSchema = z.object({
  kind: z.enum(WORKOUT_KINDS),
  title: z.string().trim().min(1, 'El título es obligatorio').max(100),
  date: z.string().datetime({ offset: true, message: 'Fecha no válida' }), // con hora, ISO desde el navegador
  minutes: z.coerce.number().int().min(1, 'Duración no válida').max(1440),
  calories: optNumber(0, 20_000).pipe(z.number().int().optional()),
  notes: optText(500),
  planned: z.coerce.boolean().default(false),
});
export type WorkoutInput = z.input<typeof workoutSchema>;

export const goalSchema = z.object({ kind: z.enum(GOAL_KINDS), target: z.coerce.number().finite() }).superRefine((g, ctx) => {
  const { min, max, label } = GOAL_META[g.kind];
  if (g.target < min || g.target > max) ctx.addIssue({ code: 'custom', path: ['target'], message: `${label}: entre ${min} y ${max}` });
});

// ── Viajes
export const tripSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(100),
  destination: z.string().trim().min(1, 'El destino es obligatorio').max(100),
  startDate: dateOnly,
  endDate: dateOnly,
  budget: optNumber(0, 1_000_000),
  notes: optText(2000),
}).superRefine((t, ctx) => {
  if (t.endDate < t.startDate) ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'La vuelta no puede ser anterior a la salida' });
  else if ((Date.parse(t.endDate) - Date.parse(t.startDate)) / 86_400_000 >= MAX_TRIP_DAYS) ctx.addIssue({ code: 'custom', path: ['endDate'], message: `Un viaje no puede durar más de ${MAX_TRIP_DAYS} días` });
});
export type TripInput = z.input<typeof tripSchema>;

const dateTime = z.preprocess(emptyToUndef, z.string().datetime({ offset: true }).optional());
export const bookingSchema = z.object({
  kind: z.enum(BOOKING_KINDS),
  title: z.string().trim().min(1, 'El título es obligatorio').max(120),
  reference: optText(60),
  startsAt: dateTime,
  endsAt: dateTime,
  cost: optNumber(0, 1_000_000),
  details: optText(500),
}).refine((b) => !b.startsAt || !b.endsAt || new Date(b.endsAt) >= new Date(b.startsAt), { message: 'El fin no puede ser anterior al inicio', path: ['endsAt'] });
export type BookingInput = z.input<typeof bookingSchema>;

export const itinerarySchema = z.object({
  date: dateOnly,
  time: z.preprocess(emptyToUndef, z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora no válida').optional()),
  title: z.string().trim().min(1, 'El título es obligatorio').max(150),
  notes: optText(500),
});
export type ItineraryInput = z.input<typeof itinerarySchema>;

export const labelSchema = z.object({ label: z.string().trim().min(1, 'Escribe algo').max(120) });

// ── Familia
export const familySchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(80),
  relation: z.string().trim().min(1, 'Indica la relación').max(40),
  birthday: z.preprocess(emptyToUndef, dateOnly.refine((s) => s <= new Date().toISOString().slice(0, 10), 'La fecha no puede ser futura').optional()),
  color: color.default('#10b981'),
  notes: optText(1000),
});
export type FamilyInput = z.input<typeof familySchema>;
