import { formatNumber } from './utils';
export const METRIC_KINDS = ['weight', 'steps', 'sleep'] as const;
export type MetricKind = (typeof METRIC_KINDS)[number];
export const METRIC_META: Record<MetricKind, { label: string; unit: string; min: number; max: number; decimals: number }> = {
  weight: { label: 'Peso', unit: 'kg', min: 20, max: 400, decimals: 1 },
  steps: { label: 'Pasos', unit: 'pasos', min: 0, max: 200_000, decimals: 0 },
  sleep: { label: 'Sueño', unit: 'h', min: 0, max: 24, decimals: 1 },
};
export const WORKOUT_KINDS = ['gym', 'padel', 'cardio', 'other'] as const;
export type WorkoutKind = (typeof WORKOUT_KINDS)[number];
export const WORKOUT_LABEL: Record<WorkoutKind, string> = { gym: 'Gimnasio', padel: 'Pádel', cardio: 'Cardio', other: 'Otro' };
export const GOAL_KINDS = ['steps', 'sleep', 'workouts', 'weight'] as const;
export type GoalKind = (typeof GOAL_KINDS)[number];
export const GOAL_META: Record<GoalKind, { label: string; unit: string; min: number; max: number }> = {
  steps: { label: 'Pasos al día', unit: 'pasos', min: 1000, max: 50_000 },
  sleep: { label: 'Sueño por noche', unit: 'h', min: 3, max: 12 },
  workouts: { label: 'Entrenos por semana', unit: 'entrenos', min: 1, max: 14 },
  weight: { label: 'Peso objetivo', unit: 'kg', min: 20, max: 400 },
};
export const DEFAULT_GOALS: Record<Exclude<GoalKind, 'weight'>, number> = { steps: 8000, sleep: 7.5, workouts: 3 };

export type Goals = Partial<Record<GoalKind, number>>;
export const withDefaultGoals = (g: Goals): Goals => ({ ...DEFAULT_GOALS, ...g });

export interface MetricPoint { date: Date; value: number }
export interface WorkoutLite { date: Date; minutes: number; calories: number | null; planned: boolean }

const DAY = 86_400_000;
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const localYmd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const average = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);

/** Lunes (00:00 local) de la semana de `d`. */
export function weekStart(d: Date): Date {
  const w = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  w.setDate(w.getDate() - ((w.getDay() + 6) % 7));
  return w;
}

/** Media de los últimos `days` días naturales (incluido hoy) usando solo los días con dato. */
export function recentAverage(points: MetricPoint[], now: Date, days: number): { avg: number | null; n: number } {
  const from = localYmd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1)));
  const to = localYmd(now);
  const vals = points.filter((p) => ymd(p.date) >= from && ymd(p.date) <= to).map((p) => p.value);
  return { avg: average(vals), n: vals.length };
}

/** Cambio entre el primer y el último dato de la ventana (null si hay menos de 2). */
export function windowChange(points: MetricPoint[], now: Date, days: number): number | null {
  const from = localYmd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1)));
  const w = points.filter((p) => ymd(p.date) >= from).sort((a, b) => a.date.getTime() - b.date.getTime());
  if (w.length < 2) return null;
  return Math.round((w[w.length - 1]!.value - w[0]!.value) * 10) / 10;
}

export interface WeekRow { label: string; start: string; sessions: number; minutes: number; partial: boolean }
/** Entrenos realizados (no planificados) por semana, de más antigua a la semana en curso (parcial). */
export function weeklyWorkouts(workouts: WorkoutLite[], now: Date, weeks = 8): WeekRow[] {
  const current = weekStart(now);
  const rows: WeekRow[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const s = new Date(current.getFullYear(), current.getMonth(), current.getDate() - i * 7);
    const e = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 7);
    const inWeek = workouts.filter((w) => !w.planned && w.date >= s && w.date < e);
    rows.push({
      label: new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(s),
      start: localYmd(s), sessions: inWeek.length, minutes: inWeek.reduce((a, w) => a + w.minutes, 0), partial: i === 0,
    });
  }
  return rows;
}

/** Semanas consecutivas en las que se cumplió la meta de entrenos; la semana en curso suma si ya la cumple, pero no rompe la racha si aún no. */
export function goalStreak(rows: WeekRow[], target: number): number {
  let streak = 0;
  const list = [...rows].reverse();
  const cur = list[0];
  if (cur?.partial && cur.sessions >= target) streak++;
  for (const r of list.slice(cur?.partial ? 1 : 0)) {
    if (r.sessions >= target) streak++;
    else break;
  }
  return streak;
}

export interface HealthSummary {
  weight: { last: number | null; change30: number | null; toGoal: number | null };
  steps: { avg7: number | null; days: number; pct: number | null };
  sleep: { avg7: number | null; days: number; pct: number | null };
  workouts: { thisWeek: number; target: number; minutesWeek: number; streak: number; plannedNext: number };
  notes: string[];
}

export function healthSummary(input: { weight: MetricPoint[]; steps: MetricPoint[]; sleep: MetricPoint[]; workouts: WorkoutLite[]; goals: Goals; now: Date }): HealthSummary {
  const goals = withDefaultGoals(input.goals);
  const { now } = input;
  const sortedW = [...input.weight].sort((a, b) => a.date.getTime() - b.date.getTime());
  const last = sortedW.at(-1)?.value ?? null;
  const s = recentAverage(input.steps, now, 7);
  const sl = recentAverage(input.sleep, now, 7);
  const rows = weeklyWorkouts(input.workouts, now, 8);
  const target = goals.workouts ?? DEFAULT_GOALS.workouts;
  const cur = rows.at(-1)!;
  const plannedNext = input.workouts.filter((w) => w.planned && w.date.getTime() >= now.getTime() - DAY / 2 && w.date.getTime() <= now.getTime() + 7 * DAY).length;
  const summary: HealthSummary = {
    weight: { last, change30: windowChange(input.weight, now, 30), toGoal: last !== null && goals.weight ? Math.round((last - goals.weight) * 10) / 10 : null },
    steps: { avg7: s.avg === null ? null : Math.round(s.avg), days: s.n, pct: s.avg === null ? null : s.avg / goals.steps! },
    sleep: { avg7: sl.avg === null ? null : Math.round(sl.avg * 10) / 10, days: sl.n, pct: sl.avg === null ? null : sl.avg / goals.sleep! },
    workouts: { thisWeek: cur.sessions, target, minutesWeek: cur.minutes, streak: goalStreak(rows, target), plannedNext },
    notes: [],
  };
  // Observaciones descriptivas, no consejo médico.
  if (summary.sleep.avg7 !== null && summary.sleep.days >= 3 && summary.sleep.avg7 < goals.sleep! - 0.75) summary.notes.push(`Duermes de media ${summary.sleep.avg7.toLocaleString('es-ES')} h (meta ${goals.sleep!.toLocaleString('es-ES')} h).`);
  if (summary.steps.avg7 !== null && summary.steps.days >= 3 && summary.steps.pct! < 0.75) summary.notes.push(`Tu media de pasos esta semana (${formatNumber(summary.steps.avg7)}) está por debajo de tu meta.`);
  const dow = (now.getDay() + 6) % 7; // 0 = lunes
  if (summary.workouts.thisWeek < target && dow >= 4 && summary.workouts.plannedNext === 0) summary.notes.push(`Llevas ${summary.workouts.thisWeek} de ${target} entrenos esta semana y no hay ninguno planificado.`);
  if (summary.workouts.streak >= 2) summary.notes.push(`Racha: ${summary.workouts.streak} semanas cumpliendo tu meta de entrenos.`);
  return summary;
}
