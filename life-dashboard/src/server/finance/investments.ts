import 'server-only';
import { db } from '@/lib/db';
import { round2 } from '@/lib/finance';
import { dividendSchema, investmentSchema, priceSchema } from '@/lib/validation-finance';
import { audit, fail, toDate, toNumber, type Tx } from './core';

const issue = (e: { issues: { message: string }[] }) => e.issues[0]?.message ?? 'Datos no válidos';

export async function ensurePortfolio(tx: Tx, userId: string) {
  return (await tx.portfolio.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' } })) ?? tx.portfolio.create({ data: { userId, name: 'Cartera principal' } });
}

/** Guarda (o actualiza) la instantánea de hoy con el valor y coste actuales de la cartera. */
export async function recordSnapshot(tx: Tx, portfolioId: string, now = new Date()) {
  const inv = await tx.investment.findMany({ where: { portfolioId } });
  const value = round2(inv.reduce((a, i) => a + toNumber(i.quantity) * toNumber(i.currentPrice), 0));
  const cost = round2(inv.reduce((a, i) => a + toNumber(i.quantity) * toNumber(i.avgCost), 0));
  const date = new Date(`${now.toISOString().slice(0, 10)}T12:00:00.000Z`);
  await tx.portfolioSnapshot.upsert({ where: { portfolioId_date: { portfolioId, date } }, update: { value, cost }, create: { portfolioId, date, value, cost } });
}

async function requireInvestment(tx: Tx, userId: string, id: string) {
  return (await tx.investment.findFirst({ where: { id, portfolio: { userId } } })) ?? fail('Posición no encontrada');
}

export async function createInvestment(userId: string, input: unknown) {
  const p = investmentSchema.safeParse(input);
  if (!p.success) return fail(issue(p.error));
  return db.$transaction(async (tx) => {
    const portfolio = await ensurePortfolio(tx, userId);
    const row = await tx.investment.create({ data: { portfolioId: portfolio.id, ...p.data } });
    await audit(tx, { userId, entity: 'Investment', entityId: row.id, action: 'create', after: row });
    await recordSnapshot(tx, portfolio.id);
    return row.id;
  });
}

export async function updateInvestment(userId: string, id: string, input: unknown) {
  const p = investmentSchema.safeParse(input);
  if (!p.success) return fail(issue(p.error));
  return db.$transaction(async (tx) => {
    const before = await requireInvestment(tx, userId, id);
    const after = await tx.investment.update({ where: { id }, data: p.data });
    await audit(tx, { userId, entity: 'Investment', entityId: id, action: 'update', before, after });
    await recordSnapshot(tx, before.portfolioId);
    return id;
  });
}

/** Actualiza solo el precio actual (entrada manual hasta que exista un proveedor de mercado). */
export async function updatePrice(userId: string, input: unknown) {
  const p = priceSchema.safeParse(input);
  if (!p.success) return fail(issue(p.error));
  return db.$transaction(async (tx) => {
    const before = await requireInvestment(tx, userId, p.data.investmentId);
    const after = await tx.investment.update({ where: { id: before.id }, data: { currentPrice: p.data.currentPrice } });
    await audit(tx, { userId, entity: 'Investment', entityId: before.id, action: 'update', before, after });
    await recordSnapshot(tx, before.portfolioId);
    return before.id;
  });
}

export async function deleteInvestment(userId: string, id: string) {
  return db.$transaction(async (tx) => {
    const before = await requireInvestment(tx, userId, id);
    await tx.investment.delete({ where: { id } });
    await audit(tx, { userId, entity: 'Investment', entityId: id, action: 'delete', before });
    await recordSnapshot(tx, before.portfolioId);
    return id;
  });
}

export async function addDividend(userId: string, input: unknown) {
  const p = dividendSchema.safeParse(input);
  if (!p.success) return fail(issue(p.error));
  return db.$transaction(async (tx) => {
    await requireInvestment(tx, userId, p.data.investmentId);
    const row = await tx.dividend.create({ data: { investmentId: p.data.investmentId, date: toDate(p.data.date), amount: p.data.amount } });
    await audit(tx, { userId, entity: 'Dividend', entityId: row.id, action: 'create', after: row });
    return row.id;
  });
}

export async function deleteDividend(userId: string, id: string) {
  return db.$transaction(async (tx) => {
    const before = await tx.dividend.findFirst({ where: { id, investment: { portfolio: { userId } } } });
    if (!before) return fail('Dividendo no encontrado');
    await tx.dividend.delete({ where: { id } });
    await audit(tx, { userId, entity: 'Dividend', entityId: id, action: 'delete', before });
    return id;
  });
}
