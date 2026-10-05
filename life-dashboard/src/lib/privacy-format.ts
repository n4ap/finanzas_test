import { z } from 'zod';
import { NEWS_CATEGORY_IDS } from './news';

/**
 * Formato del archivo de exportación/importación (JSON, versión 1). Las relaciones usan `ref` (el id original) para poder
 * reconstruirlas con ids nuevos al importar. NO incluye contraseñas, sesiones, claves ni tokens de integraciones.
 */
export const EXPORT_VERSION = 1;
export const IMPORT_MAX_BYTES = 15_000_000;

const iso = z.string().datetime({ offset: true });
const optIso = iso.nullish();
const text = (max: number) => z.string().max(max);
const optText = (max: number) => z.string().max(max).nullish();
// Caben en las columnas Decimal de la BD (hasta 10 dígitos enteros); el porcentaje (rentabilidad por dividendo) es Decimal(6,3).
const money = z.string().regex(/^-?\d{1,10}(\.\d{1,8})?$/, 'Importe no válido');
const pct = z.string().regex(/^\d{1,3}(\.\d{1,3})?$/, 'Porcentaje no válido');
const ref = z.string().min(1).max(60);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const arr = <T extends z.ZodType>(t: T, max: number) => z.array(t).max(max).default([]);

export const exportSchema = z.object({
  app: z.literal('life-dashboard'),
  version: z.literal(EXPORT_VERSION),
  exportedAt: iso,
  profile: z.object({ name: text(80), city: text(80), timezone: text(60), locale: text(10), currency: text(3), theme: z.enum(['light', 'dark', 'system']), followedNews: z.array(z.enum(NEWS_CATEGORY_IDS)).max(10).default([]) }).partial().optional(),
  projects: arr(z.object({ ref, name: text(80), description: optText(500), status: z.enum(['planned', 'active', 'paused', 'done']), priority: z.number().int().min(1).max(3), color, targetDate: optIso }), 200),
  tasks: arr(z.object({ ref, projectRef: ref.nullish(), parentRef: ref.nullish(), title: text(200), description: optText(2000), priority: z.number().int().min(1).max(3), status: z.enum(['inbox', 'next', 'in_progress', 'waiting', 'done']), dueDate: optIso, estimateMinutes: z.number().int().min(1).max(1440).nullish(), tags: z.array(text(30)).max(10).default([]), recurrence: z.enum(['daily', 'weekly', 'monthly']).nullish(), remindAt: optIso, completedAt: optIso }), 50_000),
  calendars: arr(z.object({ name: text(60), color, isDefault: z.boolean().default(false), events: arr(z.object({ title: text(200), description: optText(2000), location: optText(200), startsAt: iso, endsAt: iso, allDay: z.boolean().default(false), attendees: z.array(text(120)).max(30).default([]), important: z.boolean().default(false) }), 20_000) }), 20),
  emails: arr(z.object({ folder: z.enum(['inbox', 'sent', 'archive']), fromName: text(200), fromEmail: text(200), toEmails: z.array(text(200)).max(50).default([]), subject: text(500), body: text(200_000), snippet: text(500), receivedAt: iso, read: z.boolean(), starred: z.boolean(), important: z.boolean(), needsReply: z.boolean(), replied: z.boolean(), deadline: optIso, category: optText(40), summary: optText(1000) }), 20_000),
  bankAccounts: arr(z.object({ name: text(60), kind: z.enum(['checking', 'savings', 'cash', 'credit']), currency: text(3), openingBalance: money, transactions: arr(z.object({ date: iso, amount: money, category: text(40), description: text(200), merchant: optText(120), recurring: z.boolean().default(false), upcoming: z.boolean().default(false), source: z.enum(['manual', 'csv', 'provider']).default('manual') }), 100_000) }), 50),
  budgets: arr(z.object({ category: text(40), monthly: money }), 50),
  portfolios: arr(z.object({ name: text(80), currency: text(3), investments: arr(z.object({ assetType: z.enum(['stock', 'etf', 'fund', 'crypto']), symbol: text(20), name: text(120), quantity: money, avgCost: money, currentPrice: money, dividendYield: pct, dividends: arr(z.object({ date: iso, amount: money }), 5000) }), 500), snapshots: arr(z.object({ date: iso, value: money, cost: money }), 5000) }), 10),
  workouts: arr(z.object({ kind: z.enum(['gym', 'padel', 'cardio', 'other']), title: text(100), date: iso, minutes: z.number().int().min(1).max(1440), calories: z.number().int().min(0).max(20_000).nullish(), notes: optText(500), planned: z.boolean().default(false) }), 20_000),
  healthMetrics: arr(z.object({ kind: z.enum(['weight', 'steps', 'sleep']), date: iso, value: z.number().finite(), source: text(30).default('manual') }), 50_000),
  healthGoals: arr(z.object({ kind: z.enum(['steps', 'sleep', 'workouts', 'weight']), target: z.number().finite() }), 10),
  trips: arr(z.object({
    name: text(100), destination: text(100), startDate: iso, endDate: iso, budget: money.nullish(), notes: optText(2000),
    bookings: arr(z.object({ kind: z.enum(['flight', 'hotel', 'train', 'car', 'activity']), title: text(120), reference: optText(60), startsAt: optIso, endsAt: optIso, cost: money.nullish(), details: optText(500) }), 100),
    itinerary: arr(z.object({ date: iso, time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullish(), title: text(150), notes: optText(500) }), 500),
    packing: arr(z.object({ label: text(120), packed: z.boolean().default(false) }), 300),
  }), 200),
  family: arr(z.object({ name: text(80), relation: text(40), birthday: optIso, color, notes: optText(1000) }), 200),
  shopping: arr(z.object({ label: text(120), done: z.boolean().default(false) }), 500),
  automations: arr(z.object({ name: text(80), triggerType: text(40), triggerConfig: z.record(z.string(), z.unknown()).default({}), actionType: text(40), actionConfig: z.record(z.string(), z.unknown()).default({}), requiresConfirmation: z.boolean().default(true), enabled: z.boolean().default(true) }), 50),
  conversations: arr(z.object({ title: text(100), createdAt: iso, messages: arr(z.object({ role: z.enum(['user', 'assistant']), content: text(20_000), createdAt: iso }), 400) }), 200),
  /** Solo informativo (historial de cambios financieros): no se importa. */
  auditLog: z.array(z.unknown()).optional(),
});
export type ExportFile = z.infer<typeof exportSchema>;
export type ExportFileInput = z.input<typeof exportSchema>;
