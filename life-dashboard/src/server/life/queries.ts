import 'server-only';
import type { ProjectDTO } from '@/components/projects/types';
import type { TaskDTO } from '@/components/tasks/types';
import { db } from '@/lib/db';
import { nextBirthday } from '@/lib/family';
import { GOAL_KINDS, healthSummary, weeklyWorkouts, withDefaultGoals, type GoalKind, type Goals } from '@/lib/health';
import { projectStats } from '@/lib/projects';
import type { TaskStatus } from '@/lib/tasks';
import { BOOKING_KINDS, budgetSummary, daysUntil, groupItinerary, tripDayKeys, tripPhase, type BookingKind } from '@/lib/travel';
import { addDays, startOfDay } from '@/lib/utils';

type ProjectRow = Awaited<ReturnType<typeof db.project.findMany<{ include: { tasks: { select: { status: true; dueDate: true } } } }>>>[number];

export const toProjectDTO = (p: ProjectRow, now: Date): ProjectDTO => ({
  id: p.id, name: p.name, description: p.description, status: p.status, priority: p.priority, color: p.color, targetDate: p.targetDate?.toISOString() ?? null,
  stats: projectStats(p.tasks, p, now),
});

export const toTaskDTO = (t: Awaited<ReturnType<typeof db.task.findMany<{ include: { project: { select: { name: true; color: true } } } }>>>[number]): TaskDTO => ({
  id: t.id, title: t.title, description: t.description, priority: t.priority, status: t.status as TaskStatus,
  dueDate: t.dueDate?.toISOString() ?? null, estimateMinutes: t.estimateMinutes, projectId: t.projectId, projectName: t.project?.name ?? null, projectColor: t.project?.color ?? null,
  parentId: t.parentId, tags: t.tags, recurrence: t.recurrence, remindAt: t.remindAt?.toISOString() ?? null, completedAt: t.completedAt?.toISOString() ?? null,
});

/** Proyectos del usuario con su estado calculado; los que necesitan atención primero. */
export async function listProjects(userId: string, now = new Date()): Promise<ProjectDTO[]> {
  const rows = await db.project.findMany({ where: { userId }, include: { tasks: { where: { parentId: null }, select: { status: true, dueDate: true } } } });
  const rank = { late: 0, at_risk: 1, on_track: 2, empty: 3, paused: 4, done: 5 } as const;
  return rows.map((r) => toProjectDTO(r, now)).sort((a, b) => rank[a.stats.health] - rank[b.stats.health] || a.priority - b.priority || a.name.localeCompare(b.name));
}

// ───────────── Salud ─────────────
export async function getHealthData(userId: string, now = new Date()) {
  const from = addDays(startOfDay(now), -90);
  const [metrics, workouts, goalRows] = await Promise.all([
    db.healthMetric.findMany({ where: { userId, date: { gte: from } }, orderBy: { date: 'asc' } }),
    db.workout.findMany({ where: { userId, date: { gte: from, lte: addDays(now, 30) } }, orderBy: { date: 'desc' } }),
    db.healthGoal.findMany({ where: { userId } }),
  ]);
  const goals: Goals = {};
  for (const g of goalRows) if ((GOAL_KINDS as readonly string[]).includes(g.kind)) goals[g.kind as GoalKind] = g.target;
  const series = (kind: string) => metrics.filter((m) => m.kind === kind).map((m) => ({ date: m.date, value: m.value }));
  const summary = healthSummary({ weight: series('weight'), steps: series('steps'), sleep: series('sleep'), workouts, goals, now });
  const day = (p: { date: Date; value: number }) => ({ date: p.date.toISOString().slice(0, 10), value: p.value });
  return {
    summary,
    goals: withDefaultGoals(goals),
    customGoals: goals,
    weight: series('weight').map(day),
    steps: series('steps').slice(-14).map(day),
    sleep: series('sleep').slice(-14).map(day),
    weeks: weeklyWorkouts(workouts, now, 8),
    workouts: workouts.map((w) => ({ id: w.id, kind: w.kind, title: w.title, date: w.date.toISOString(), minutes: w.minutes, calories: w.calories, notes: w.notes, planned: w.planned })),
    metrics: [...metrics].reverse().slice(0, 40).map((m) => ({ id: m.id, kind: m.kind, date: m.date.toISOString().slice(0, 10), value: m.value, source: m.source })),
  };
}
export type HealthData = Awaited<ReturnType<typeof getHealthData>>;

// ───────────── Viajes ─────────────

const dayStr = (d: Date) => d.toISOString().slice(0, 10);
const money = (d: { toString(): string } | null) => (d == null ? null : Number(d.toString()));

export async function listTrips(userId: string, now = new Date()) {
  const rows = await db.trip.findMany({ where: { userId }, include: { bookings: { select: { cost: true } } }, orderBy: { startDate: 'asc' } });
  return rows.map((t) => ({
    id: t.id, name: t.name, destination: t.destination, startDate: dayStr(t.startDate), endDate: dayStr(t.endDate),
    phase: tripPhase(t.startDate, t.endDate, now), daysUntil: daysUntil(t.startDate, now), bookings: t.bookings.length,
    budget: budgetSummary(money(t.budget), t.bookings.map((b) => money(b.cost))),
  }));
}
export type TripCardDTO = Awaited<ReturnType<typeof listTrips>>[number];

export async function getTrip(userId: string, id: string, now = new Date()) {
  const t = await db.trip.findFirst({ where: { id, userId }, include: { bookings: { orderBy: [{ startsAt: 'asc' }, { createdAt: 'asc' }] }, days: true, packing: { orderBy: { id: 'asc' } } } });
  if (!t) return null;
  const keys = tripDayKeys(t.startDate, t.endDate);
  return {
    id: t.id, name: t.name, destination: t.destination, startDate: dayStr(t.startDate), endDate: dayStr(t.endDate), notes: t.notes, budgetAmount: money(t.budget),
    phase: tripPhase(t.startDate, t.endDate, now), daysUntil: daysUntil(t.startDate, now), dayKeys: keys,
    budget: budgetSummary(money(t.budget), t.bookings.map((b) => money(b.cost))),
    bookings: t.bookings.map((b) => ({ id: b.id, kind: (BOOKING_KINDS as readonly string[]).includes(b.kind) ? (b.kind as BookingKind) : ('activity' as BookingKind), title: b.title, reference: b.reference, startsAt: b.startsAt?.toISOString() ?? null, endsAt: b.endsAt?.toISOString() ?? null, cost: money(b.cost), details: b.details })),
    plan: groupItinerary(t.days, keys).map((d) => ({ ...d, items: d.items.map((i) => ({ id: i.id, time: i.time, title: i.title, notes: i.notes })) })),
    packing: t.packing.map((p) => ({ id: p.id, label: p.label, packed: p.packed })),
  };
}
export type TripDetailDTO = NonNullable<Awaited<ReturnType<typeof getTrip>>>;

// ───────────── Familia ─────────────

export async function getFamilyData(userId: string, now = new Date()) {
  const [members, shopping] = await Promise.all([
    db.familyMember.findMany({ where: { userId }, orderBy: { name: 'asc' } }),
    db.shoppingItem.findMany({ where: { userId }, orderBy: [{ done: 'asc' }, { createdAt: 'asc' }] }),
  ]);
  const list = members.map((m) => {
    const nb = m.birthday ? nextBirthday(m.birthday, now) : null;
    return {
      id: m.id, name: m.name, relation: m.relation, color: m.color, notes: m.notes, birthday: m.birthday ? dayStr(m.birthday) : null,
      next: nb ? { date: dayStr(nb.date), daysUntil: nb.daysUntil, turning: nb.turning } : null,
    };
  });
  list.sort((a, b) => (a.next?.daysUntil ?? 9999) - (b.next?.daysUntil ?? 9999) || a.name.localeCompare(b.name));
  return { members: list, shopping: shopping.map((s) => ({ id: s.id, label: s.label, done: s.done })) };
}
export type FamilyData = Awaited<ReturnType<typeof getFamilyData>>;
