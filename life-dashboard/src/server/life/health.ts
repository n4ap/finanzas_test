import 'server-only';
import { db } from '@/lib/db';
import { goalSchema, healthImportSchema, metricSchema, workoutSchema } from '@/lib/validation-life';
import { LIMITS, fail, issue, toNoon } from './core';

/** Una medición manual por tipo y día: si ya existe, se sustituye (corregir un dato = volver a guardarlo). */
export async function saveMetric(userId: string, input: unknown) {
  const p = metricSchema.safeParse(input);
  if (!p.success) return fail(issue(p.error));
  const date = toNoon(p.data.date);
  await db.healthMetric.upsert({
    where: { userId_kind_date_source: { userId, kind: p.data.kind, date, source: 'manual' } },
    create: { userId, kind: p.data.kind, date, value: p.data.value, source: 'manual' },
    update: { value: p.data.value },
  });
}

/**
 * Importa pasos y sueño de Garmin (origen «garmin»). Un dato por tipo y día: lo importado sustituye a lo que hubiera
 * ese día (también lo apuntado a mano) para no contar dos veces; reimportar el mismo archivo no duplica nada.
 */
export async function importHealthMetrics(userId: string, input: unknown) {
  const p = healthImportSchema.safeParse(input);
  if (!p.success) return fail(issue(p.error));
  const rows = p.data.rows.map((r) => ({ kind: r.kind, date: toNoon(r.date), value: r.value }));
  await db.$transaction([
    db.healthMetric.deleteMany({ where: { userId, OR: rows.map((r) => ({ kind: r.kind, date: r.date })) } }),
    db.healthMetric.createMany({ data: rows.map((r) => ({ userId, ...r, source: 'garmin' })) }),
  ]);
  return { steps: rows.filter((r) => r.kind === 'steps').length, sleep: rows.filter((r) => r.kind === 'sleep').length };
}

export async function deleteMetric(userId: string, id: string) {
  const r = await db.healthMetric.deleteMany({ where: { id, userId } });
  if (r.count === 0) fail('Medición no encontrada');
}

const workoutData = (w: ReturnType<typeof workoutSchema.parse>) => ({
  kind: w.kind, title: w.title, date: new Date(w.date), minutes: w.minutes, calories: w.calories ?? null, notes: w.notes ?? null, planned: w.planned,
});

export async function createWorkout(userId: string, input: unknown) {
  const p = workoutSchema.safeParse(input);
  if (!p.success) return fail(issue(p.error));
  if ((await db.workout.count({ where: { userId } })) >= LIMITS.workouts) return fail('Has alcanzado el máximo de entrenos');
  return (await db.workout.create({ data: { userId, ...workoutData(p.data) } })).id;
}

export async function updateWorkout(userId: string, id: string, input: unknown) {
  const p = workoutSchema.safeParse(input);
  if (!p.success) return fail(issue(p.error));
  const r = await db.workout.updateMany({ where: { id, userId }, data: workoutData(p.data) });
  if (r.count === 0) fail('Entreno no encontrado');
}

/** Marca como hecho un entreno planificado. */
export async function completeWorkout(userId: string, id: string) {
  const r = await db.workout.updateMany({ where: { id, userId, planned: true }, data: { planned: false } });
  if (r.count === 0) fail('Entreno no encontrado');
}

export async function deleteWorkout(userId: string, id: string) {
  const r = await db.workout.deleteMany({ where: { id, userId } });
  if (r.count === 0) fail('Entreno no encontrado');
}

export async function setGoal(userId: string, input: unknown) {
  const p = goalSchema.safeParse(input);
  if (!p.success) return fail(issue(p.error));
  await db.healthGoal.upsert({ where: { userId_kind: { userId, kind: p.data.kind } }, create: { userId, kind: p.data.kind, target: p.data.target }, update: { target: p.data.target } });
}
