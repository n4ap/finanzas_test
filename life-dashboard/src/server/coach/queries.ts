import 'server-only';
import { db } from '@/lib/db';
import {
  coachInsights, dailyFocus, daysBetween, interviewProgress, lifeMap, monthlyComparison, monthOf, periodFor, scoreTrends,
  weekStart, type GoalLite, type Scores,
} from '@/lib/coach';
import { localKey } from '@/lib/tz';
import { getDashboardData } from '../dashboard-data';
import { getHealthData } from '../life/queries';
import { tzOffsetMinutes } from '../settings/profile';

const dayKey = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

/** Todo lo que necesita la sección Coach (y el asistente): perfil, objetivos, revisiones, tendencias, alertas y panel. */
export async function getCoachData(userId: string, now = new Date()) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, timezone: true } });
  const today = localKey(now, tzOffsetMinutes(user.timezone, now));
  const [answers, goals, daily, weekly, monthly, decisions, health, dash] = await Promise.all([
    db.coachAnswer.findMany({ where: { userId }, select: { key: true, answer: true, updatedAt: true } }),
    db.goal.findMany({ where: { userId }, orderBy: [{ status: 'asc' }, { createdAt: 'asc' }] }),
    db.review.findMany({ where: { userId, kind: 'daily' }, orderBy: { period: 'desc' }, take: 14 }),
    db.review.findMany({ where: { userId, kind: 'weekly' }, orderBy: { period: 'desc' }, take: 16 }),
    db.review.findMany({ where: { userId, kind: 'monthly' }, orderBy: { period: 'desc' }, take: 6 }),
    db.decision.findMany({ where: { userId }, orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }], take: 50 }),
    getHealthData(userId, now),
    getDashboardData(userId, now),
  ]);

  const goalDTOs = goals.map((g) => ({
    id: g.id, parentId: g.parentId, level: g.level, area: g.area, title: g.title, why: g.why, metric: g.metric, baseline: g.baseline, target: g.target,
    progress: g.progress, dueDate: dayKey(g.dueDate), nextAction: g.nextAction, obstacles: g.obstacles, planB: g.planB, status: g.status,
  }));
  const lite: GoalLite[] = goalDTOs;
  const weeklyScores = weekly.map((w) => ({ period: w.period, scores: (w.scores ?? {}) as Scores }));
  const trends = weeklyScores.length ? scoreTrends(weeklyScores) : null;
  const progress = interviewProgress(answers.map((a) => a.key));

  const lastDone = health.workouts.filter((w) => !w.planned && w.date <= now.toISOString()).map((w) => w.date.slice(0, 10)).sort().at(-1) ?? null;
  const tasks = dash.taskLite.map((t) => ({ id: t.id, title: t.title, priority: t.priority, status: t.status, dueKey: dayKey(t.dueDate) }));
  const focus = dailyFocus(today, tasks, lite);
  const month = dash.finance.month;
  const insights = coachInsights({
    todayKey: today,
    goals: lite,
    lastWeekly: weekly[0]?.period ?? null,
    recentDaily: daily.map((d) => ({ period: d.period, mood: d.mood, energy: d.energy, stress: d.stress })),
    trends,
    health: { sleepAvg: health.summary.sleep.avg7, workoutsWeek: health.summary.workouts.thisWeek, workoutTarget: health.summary.workouts.target, daysSinceWorkout: lastDone ? daysBetween(lastDone, today) : null },
    finance: { income: month.income, expenses: month.expenses, savingRate: month.savingRate, overBudget: dash.finance.budgets.filter((b) => b.status === 'over').map((b) => b.category) },
    overdueTasks: focus.postponedCount,
    interview: { answered: progress.answered, complete: progress.complete },
  });

  const active = goalDTOs.filter((g) => g.status === 'active');
  const main = active.filter((g) => g.level === 'quarterly').sort((a, b) => a.progress - b.progress)[0] ?? active.find((g) => g.level === 'annual') ?? null;
  const lastDaily = daily[0] ?? null;
  const learning = active.filter((g) => g.area === 'crecimiento' && g.level !== 'vision');
  const lastScores = trends ? Object.fromEntries(trends.areas.map((a) => [a.id, a.last])) as Record<string, number | null> : {};
  const nextBirthday = [...(await db.familyMember.findMany({ where: { userId, birthday: { not: null } }, select: { name: true, birthday: true } }))]
    .map((m) => ({ name: m.name, key: m.birthday!.toISOString().slice(5, 10) }))
    .sort((a, b) => ((a.key >= today.slice(5) ? '0' : '1') + a.key).localeCompare((b.key >= today.slice(5) ? '0' : '1') + b.key))[0] ?? null;

  return {
    name: user.name,
    today,
    periods: { daily: periodFor('daily', today), weekly: weekStart(today), monthly: monthOf(today) },
    interview: progress,
    answers: Object.fromEntries(answers.map((a) => [a.key, a.answer])) as Record<string, string>,
    lifeMap: lifeMap(answers),
    goals: goalDTOs,
    reviews: {
      daily: daily.map((r) => ({ period: r.period, answers: r.answers as Record<string, string>, energy: r.energy, mood: r.mood, stress: r.stress })),
      weekly: weekly.map((r) => ({ period: r.period, answers: r.answers as Record<string, string>, scores: (r.scores ?? {}) as Scores })),
      monthly: monthly.map((r) => ({ period: r.period, answers: r.answers as Record<string, string> })),
    },
    trends,
    monthCompare: monthlyComparison(weeklyScores, monthOf(today)),
    decisions: decisions.map((d) => ({ id: d.id, title: d.title, objective: d.objective, options: d.options as { name: string; pros: string | null; cons: string | null; risks: string | null; cost: string | null }[], impact: d.impact, recommendation: d.recommendation, nextAction: d.nextAction, status: d.status, chosen: d.chosen, updatedAt: d.updatedAt.toISOString() })),
    insights,
    focus,
    weekData: {
      workouts: health.summary.workouts.thisWeek, workoutTarget: health.summary.workouts.target, sleepAvg: health.summary.sleep.avg7, stepsAvg: health.summary.steps.avg7,
      tasksDone: dash.tasks.filter((t) => t.status === 'done' && t.completedAt && daysBetween(dayKey(t.completedAt)!, today) < 7).length,
      spent: month.expenses,
    },
    panel: {
      goal: main ? { title: main.title, progress: main.progress, nextAction: main.nextAction, area: main.area } : null,
      health: {
        workouts: `${health.summary.workouts.thisWeek}/${health.summary.workouts.target} esta semana`,
        sleep: health.summary.sleep.avg7 !== null ? `${health.summary.sleep.avg7.toLocaleString('es-ES')} h de media` : null,
        steps: health.summary.steps.avg7,
        recovery: lastScores.descanso ?? null,
        food: lastScores.fisica ?? null,
      },
      finance: { income: month.income, expenses: month.expenses, saving: month.saving, savingRate: month.savingRate, investments: dash.positions.value, netWorth: dash.finance.netWorth },
      work: { priority: dash.nextAction?.title ?? focus.important[0]?.title ?? null, projects: dash.projects.filter((p) => p.status === 'active').length, nextAction: focus.now },
      mind: lastDaily ? { day: lastDaily.period, mood: lastDaily.mood, energy: lastDaily.energy, stress: lastDaily.stress } : null,
      relations: { score: lastScores.relaciones ?? null, nextBirthday },
      learning: learning.slice(0, 2).map((g) => ({ title: g.title, nextAction: g.nextAction })),
    },
  };
}
export type CoachData = Awaited<ReturnType<typeof getCoachData>>;
