import 'server-only';
import { db } from '@/lib/db';
import { fromCents, sumMoney, toCents } from '@/lib/finance';
import { budgetUsage, dividendsByMonth, evolutionSeries, monthSummary, monthlySeries, portfolioStats } from '../metrics';
import { accessibleAccountsWhere, toNumber } from './core';

export const PAGE_SIZE = 40;

export interface FinanceParams { month: string; accountId?: string; category?: string; q?: string; page: number }

export function parseMonth(s: string | undefined, now = new Date()): { key: string; start: Date; end: Date; date: Date } {
  const m = s?.match(/^(\d{4})-(\d{2})$/);
  const y = m ? Number(m[1]) : now.getFullYear();
  const mo = m ? Math.min(12, Math.max(1, Number(m[2]))) : now.getMonth() + 1;
  return { key: `${y}-${String(mo).padStart(2, '0')}`, start: new Date(Date.UTC(y, mo - 1, 1)), end: new Date(Date.UTC(y, mo, 1)), date: new Date(y, mo - 1, 15) };
}

/** Todo lo que necesita /finance en una sola carga. Acotado a las cuentas accesibles (propias + compartidas). */
export async function getFinanceOverview(userId: string, p: FinanceParams, now = new Date()) {
  const month = parseMonth(p.month, now);
  const accounts = await db.bankAccount.findMany({
    where: accessibleAccountsWhere(userId), orderBy: [{ createdAt: 'asc' }],
    include: { household: { include: { members: { include: { user: { select: { id: true, name: true } } } } } } },
  });
  const allIds = accounts.map((a) => a.id);
  const scopeIds = p.accountId && allIds.includes(p.accountId) ? [p.accountId] : allIds;

  const sums = await db.transaction.groupBy({ by: ['accountId'], where: { accountId: { in: allIds }, upcoming: false }, _sum: { amount: true } });
  const sumBy = new Map(sums.map((s) => [s.accountId, s._sum.amount ? toNumber(s._sum.amount) : 0]));
  const accountDTOs = accounts.map((a) => ({
    id: a.id, name: a.name, kind: a.kind, balance: sumMoney([toNumber(a.openingBalance), sumBy.get(a.id) ?? 0]), openingBalance: toNumber(a.openingBalance),
    isOwner: a.ownerId === userId, shared: !!a.householdId,
    sharedWith: a.household?.members.filter((m) => m.userId !== userId).map((m) => m.user.name) ?? [],
  }));

  const from6 = new Date(Date.UTC(month.date.getFullYear(), month.date.getMonth() - 5, 1));
  const txFilter = {
    accountId: { in: scopeIds }, date: { gte: month.start, lt: month.end },
    ...(p.category ? { category: p.category } : {}),
    ...(p.q ? { OR: [{ description: { contains: p.q, mode: 'insensitive' as const } }, { merchant: { contains: p.q, mode: 'insensitive' as const } }] } : {}),
  };
  const [history, page, total, budgets, upcoming, positions, auditRows] = await Promise.all([
    db.transaction.findMany({ where: { accountId: { in: scopeIds }, upcoming: false, date: { gte: from6, lt: month.end } }, select: { date: true, amount: true, category: true } }),
    db.transaction.findMany({ where: txFilter, orderBy: [{ date: 'desc' }, { createdAt: 'desc' }], skip: (Math.max(1, p.page) - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { user: { select: { name: true } } } }),
    db.transaction.count({ where: txFilter }),
    db.budget.findMany({ where: { userId } }),
    db.transaction.findMany({ where: { accountId: { in: scopeIds }, upcoming: true, date: { gte: new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) } }, orderBy: { date: 'asc' }, take: 8 }),
    db.investment.findMany({ where: { portfolio: { userId } }, select: { quantity: true, currentPrice: true, avgCost: true, assetType: true, symbol: true, dividendYield: true } }),
    db.auditLog.findMany({
      where: { OR: [{ userId }, ...allIds.map((id) => ({ entity: 'Transaction', OR: [{ after: { path: ['accountId'], equals: id } }, { before: { path: ['accountId'], equals: id } }] })), { entity: 'BankAccount', entityId: { in: allIds } }] },
      orderBy: { createdAt: 'desc' }, take: 40, include: { user: { select: { name: true } } },
    }),
  ]);

  const lite = history.map((t) => ({ date: t.date, amount: toNumber(t.amount), category: t.category }));
  const summary = monthSummary(lite, month.date);
  const prevMonth = new Date(month.date.getFullYear(), month.date.getMonth() - 1, 15);
  // Si el mes elegido es el actual (incompleto), se compara con el mismo punto del mes anterior para no dar una caída/subida falsa.
  const isCurrent = month.key === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prev = monthSummary(isCurrent ? lite.filter((t) => t.date.getFullYear() * 12 + t.date.getMonth() !== prevMonth.getFullYear() * 12 + prevMonth.getMonth() || t.date.getUTCDate() <= now.getDate()) : lite, prevMonth);
  const budgetRows = budgetUsage(budgets.map((b) => ({ category: b.category, monthly: toNumber(b.monthly) })), summary.byCategory);
  const cash = sumMoney(accountDTOs.filter((a) => scopeIds.includes(a.id)).map((a) => a.balance));
  const invested = portfolioStats(positions.map((i) => ({ symbol: i.symbol, assetType: i.assetType, quantity: toNumber(i.quantity), avgCost: toNumber(i.avgCost), currentPrice: toNumber(i.currentPrice), dividendYield: toNumber(i.dividendYield) }))).value;

  return {
    month: month.key, accounts: accountDTOs, scopeIds,
    transactions: { total, pageSize: PAGE_SIZE, items: page.map((t) => ({ id: t.id, accountId: t.accountId, date: t.date.toISOString().slice(0, 10), amount: toNumber(t.amount), category: t.category, description: t.description, merchant: t.merchant, recurring: t.recurring, upcoming: t.upcoming, source: t.source, by: t.user.name })) },
    summary, prev: { income: prev.income, expenses: prev.expenses, saving: prev.saving, samePeriod: isCurrent },
    series: monthlySeries(lite, month.date, 6).map((m, i, all) => ({ ...m, partial: isCurrent && i === all.length - 1 })),
    budgets: budgetRows, allBudgets: budgets.map((b) => ({ category: b.category, monthly: toNumber(b.monthly) })),
    upcoming: upcoming.map((t) => ({ id: t.id, date: t.date.toISOString().slice(0, 10), description: t.description, amount: toNumber(t.amount), category: t.category })),
    cash, invested, netWorth: fromCents(toCents(cash) + toCents(invested)),
    audit: auditRows.map((a) => ({ id: a.id, entity: a.entity, action: a.action, by: a.user.name, at: a.createdAt.toISOString(), summary: describeAudit(a.entity, a.before, a.after) })),
  };
}

type Json = unknown;
/** Resumen legible de un cambio auditado. */
export function describeAudit(entity: string, before: Json, after: Json): string {
  const row = (after ?? before) as Record<string, unknown> | null;
  if (!row) return entity;
  const name = String(row.description ?? row.name ?? row.symbol ?? row.category ?? '');
  const amount = row.amount !== undefined ? ` · ${Number(row.amount).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}` : '';
  return `${name}${amount}`;
}

export type FinanceOverview = Awaited<ReturnType<typeof getFinanceOverview>>;

// ───────────── Inversiones ─────────────
export async function getInvestmentsOverview(userId: string, now = new Date()) {
  const portfolio = await db.portfolio.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' } });
  const [investments, snaps, dividends] = await Promise.all([
    db.investment.findMany({ where: { portfolio: { userId } }, orderBy: { symbol: 'asc' } }),
    portfolio ? db.portfolioSnapshot.findMany({ where: { portfolioId: portfolio.id }, orderBy: { date: 'asc' } }) : [],
    db.dividend.findMany({ where: { investment: { portfolio: { userId } } }, orderBy: { date: 'desc' }, include: { investment: { select: { symbol: true, name: true } } } }),
  ]);
  const stats = portfolioStats(investments.map((i) => ({ symbol: i.symbol, assetType: i.assetType, quantity: toNumber(i.quantity), avgCost: toNumber(i.avgCost), currentPrice: toNumber(i.currentPrice), dividendYield: toNumber(i.dividendYield) })));
  const received12 = dividendsByMonth(dividends.map((d) => ({ date: d.date, amount: toNumber(d.amount) })), now, 12);
  return {
    positions: investments.map((i, idx) => ({ id: i.id, assetType: i.assetType, symbol: i.symbol, name: i.name, quantity: toNumber(i.quantity), avgCost: toNumber(i.avgCost), currentPrice: toNumber(i.currentPrice), dividendYield: toNumber(i.dividendYield), isin: i.isin, value: stats.rows[idx]!.value, pnl: stats.rows[idx]!.pnl, pnlPct: stats.rows[idx]!.pnlPct, weight: stats.value > 0 ? stats.rows[idx]!.value / stats.value : 0, annualDividend: stats.rows[idx]!.annualDividend })),
    totals: { value: stats.value, cost: stats.cost, pnl: stats.pnl, pnlPct: stats.pnlPct, annualDividends: stats.annualDividends },
    allocation: stats.allocation,
    evolution: evolutionSeries(snaps.map((s) => ({ date: s.date, value: toNumber(s.value), cost: toNumber(s.cost) }))),
    dividendsByMonth: received12,
    dividendsReceived12: sumMoney(received12.map((d) => d.amount)),
    dividendList: dividends.slice(0, 20).map((d) => ({ id: d.id, date: d.date.toISOString().slice(0, 10), amount: toNumber(d.amount), symbol: d.investment.symbol })),
  };
}
export type InvestmentsOverview = Awaited<ReturnType<typeof getInvestmentsOverview>>;
