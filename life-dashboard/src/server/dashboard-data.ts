import 'server-only';
import { db } from '@/lib/db';
import { addDays, endOfDay, startOfDay } from '@/lib/utils';
import { daysUntil } from '@/lib/travel';
import { nextBirthday } from '@/lib/family';
import { projectStats } from '@/lib/projects';
import { buildPriorities, recommendNextAction, type EventLite, type TaskLite } from './insights';
import { topOfToday } from './news-rank';
import { accessibleAccountsWhere } from './finance/core';
import { budgetUsage, monthSummary, monthlySeries, portfolioStats } from './metrics';
import { sumMoney } from '@/lib/finance';

/** Carga y deriva todo lo que necesita el dashboard. Cada consulta está acotada por userId. */
export async function getDashboardData(userId: string, now = new Date()) {
  const prefs = await db.user.findUnique({ where: { id: userId }, select: { preferences: true } });
  const followedNews = ((prefs?.preferences as { followedNews?: string[] } | null)?.followedNews ?? []).filter((f) => typeof f === 'string');
  const dayStart = startOfDay(now);
  const [tasks, events, emails, news, txs, accounts, budgets, investments, metrics, workouts, projects, trips, notifications, family] = await Promise.all([
    db.task.findMany({ where: { userId, parentId: null }, include: { project: { select: { name: true } } }, orderBy: [{ priority: 'asc' }, { dueDate: 'asc' }] }),
    db.event.findMany({ where: { calendar: { userId }, startsAt: { gte: addDays(dayStart, -1), lte: endOfDay(addDays(now, 14)) } }, include: { calendar: { select: { name: true, color: true } } }, orderBy: { startsAt: 'asc' } }),
    db.email.findMany({ where: { userId, folder: 'inbox' }, orderBy: { receivedAt: 'desc' }, take: 30 }),
    db.newsArticle.findMany({ where: { userId }, orderBy: [{ importance: 'desc' }, { publishedAt: 'desc' }], take: 20 }),
    db.transaction.findMany({ where: { account: accessibleAccountsWhere(userId), date: { gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) } } }),
    db.bankAccount.findMany({ where: accessibleAccountsWhere(userId), include: { transactions: { where: { upcoming: false }, select: { amount: true } } } }),
    db.budget.findMany({ where: { userId } }),
    db.investment.findMany({ where: { portfolio: { userId } } }),
    db.healthMetric.findMany({ where: { userId, date: { gte: addDays(dayStart, -30) } }, orderBy: { date: 'asc' } }),
    db.workout.findMany({ where: { userId, date: { gte: addDays(dayStart, -30), lte: endOfDay(addDays(now, 7)) } }, orderBy: { date: 'asc' } }),
    db.project.findMany({ where: { userId }, include: { tasks: { where: { parentId: null }, select: { status: true, dueDate: true } } }, orderBy: { priority: 'asc' } }),
    db.trip.findMany({ where: { userId, endDate: { gte: dayStart } }, include: { packing: { select: { packed: true } } }, orderBy: { startDate: 'asc' }, take: 3 }),
    db.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 5 }),
    db.familyMember.findMany({ where: { userId, birthday: { not: null } } }),
  ]);

  const num = (d: { toString(): string }) => Number(d.toString());
  const paid = txs.filter((t) => !t.upcoming).map((t) => ({ date: t.date, amount: num(t.amount), category: t.category }));
  const upcomingPayments = txs.filter((t) => t.upcoming).map((t) => ({ id: t.id, description: t.description, amount: num(t.amount), date: t.date }));

  const taskLite: TaskLite[] = tasks.map((t) => ({ id: t.id, title: t.title, priority: t.priority, status: t.status, dueDate: t.dueDate, estimateMinutes: t.estimateMinutes, projectName: t.project?.name }));
  const eventLite: EventLite[] = events.map((e) => ({ id: e.id, title: e.title, startsAt: e.startsAt, endsAt: e.endsAt, location: e.location, important: e.important }));
  const todayEvents = events.filter((e) => e.startsAt >= dayStart && e.startsAt <= endOfDay(now));

  const positions = portfolioStats(investments.map((i) => ({ symbol: i.symbol, assetType: i.assetType, quantity: num(i.quantity), avgCost: num(i.avgCost), currentPrice: num(i.currentPrice), dividendYield: num(i.dividendYield) })));
  const cash = sumMoney(accounts.flatMap((acc) => [num(acc.openingBalance), ...acc.transactions.map((t) => num(t.amount))]));
  const month = monthSummary(paid, now);
  const budgetRows = budgetUsage(budgets.map((b) => ({ category: b.category, monthly: num(b.monthly) })), month.byCategory);

  const series = (kind: string) => metrics.filter((m) => m.kind === kind).map((m) => ({ date: m.date, value: m.value }));

  const projectRows = projects.map((p) => ({ ...p, stats: projectStats(p.tasks, p, now) }));
  const birthdays = family.flatMap((m) => { const b = nextBirthday(m.birthday!, now); return [{ id: m.id, name: m.name, daysUntil: b.daysUntil, turning: b.turning }]; });
  const tripLite = trips.map((t) => ({ id: t.id, name: t.name, daysUntil: daysUntil(t.startDate, now), packingPending: t.packing.filter((p) => !p.packed).length, packingTotal: t.packing.length }));

  return {
    now,
    tasks, taskLite, events, eventLite, todayEvents, emails, notifications, trips,
    topNews: topOfToday(news, followedNews, now),
    upcomingPayments,
    priorities: buildPriorities({
      now, tasks: taskLite, events: eventLite, upcomingPayments, spend: paid, budgets: budgetRows,
      projects: projectRows.map((p) => ({ id: p.id, name: p.name, health: p.stats.health, reason: p.stats.reason })), birthdays, trips: tripLite,
      emails: emails.map((e) => ({ id: e.id, subject: e.subject, fromName: e.fromName, needsReply: e.needsReply, replied: e.replied, deadline: e.deadline, important: e.important })),
    }),
    nextAction: recommendNextAction({ now, tasks: taskLite, events: eventLite }),
    finance: { month, series: monthlySeries(paid, now), cash, netWorth: sumMoney([cash, positions.value]), budgets: budgetRows },
    positions,
    health: { weight: series('weight'), steps: series('steps'), sleep: series('sleep'), workouts },
    projects: projectRows.map((p) => ({ id: p.id, name: p.name, color: p.color, status: p.status, progress: p.stats.progress, health: p.stats.health })),
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
