export const BOOKING_KINDS = ['flight', 'hotel', 'train', 'car', 'activity'] as const;
export type BookingKind = (typeof BOOKING_KINDS)[number];
export const BOOKING_LABEL: Record<BookingKind, string> = { flight: 'Vuelo', hotel: 'Alojamiento', train: 'Tren', car: 'Coche', activity: 'Actividad' };
export const MAX_TRIP_DAYS = 90;

export const DEFAULT_PACKING = ['DNI / pasaporte', 'Cargador del móvil', 'Documentación de reservas', 'Neceser', 'Medicación', 'Ropa para los días del viaje'];

export type TripPhase = 'upcoming' | 'ongoing' | 'past';
export const PHASE_LABEL: Record<TripPhase, string> = { upcoming: 'Próximo', ongoing: 'En curso', past: 'Finalizado' };

const key = (d: Date) => d.toISOString().slice(0, 10);
const localKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function tripPhase(start: Date, end: Date, now: Date): TripPhase {
  const today = localKey(now);
  if (today < key(start)) return 'upcoming';
  if (today > key(end)) return 'past';
  return 'ongoing';
}

/** Días hasta la salida (0 = sale hoy, negativo = ya salió). */
export function daysUntil(start: Date, now: Date): number {
  const a = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const b = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  return Math.round((b - a) / 86_400_000);
}

/** Todas las fechas 'YYYY-MM-DD' del viaje, ambas incluidas (tope MAX_TRIP_DAYS + 1 como defensa). */
export function tripDayKeys(start: Date, end: Date): string[] {
  const out: string[] = [];
  const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(), 12));
  const last = key(end);
  while (key(d) <= last && out.length <= MAX_TRIP_DAYS) { out.push(key(d)); d.setUTCDate(d.getUTCDate() + 1); }
  return out;
}

export interface BudgetSummary { spent: number; budget: number | null; remaining: number | null; pct: number | null; status: 'none' | 'ok' | 'warn' | 'over' }
/** Gasto comprometido (reservas con coste) frente al presupuesto. Suma en céntimos para evitar errores de coma flotante. */
export function budgetSummary(budget: number | null, costs: (number | null)[]): BudgetSummary {
  const spent = costs.reduce<number>((a, c) => a + Math.round((c ?? 0) * 100), 0) / 100;
  if (budget === null || budget <= 0) return { spent, budget: null, remaining: null, pct: null, status: 'none' };
  const pct = spent / budget;
  return { spent, budget, remaining: Math.round((budget - spent) * 100) / 100, pct, status: pct > 1 ? 'over' : pct >= 0.8 ? 'warn' : 'ok' };
}

export interface ItineraryLite { id: string; date: Date; time: string | null; title: string; notes: string | null }
export interface DayPlan<T extends ItineraryLite = ItineraryLite> { date: string; n: number; items: T[] }
/** Agrupa por día del viaje (lo que cae fuera de las fechas se descarta) y ordena por hora; sin hora al final. */
export function groupItinerary<T extends ItineraryLite>(items: T[], dayKeys: string[]): DayPlan<T>[] {
  return dayKeys.map((date, i) => ({
    date, n: i + 1,
    items: items.filter((it) => key(it.date) === date).sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99') || a.title.localeCompare(b.title)),
  }));
}
