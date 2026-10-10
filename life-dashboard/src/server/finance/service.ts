import 'server-only';
import { db } from '@/lib/db';
import { dedupeKey, markDuplicates, type ImportRow } from '@/lib/finance';
import { accountSchema, budgetSchema, importRowSchema, importSchema, shareSchema, transactionSchema } from '@/lib/validation-finance';
import { ServiceError, accessibleAccountsWhere, audit, fail, requireAccountAccess, requireAccountOwner, toDate, toNumber } from './core';

/** Rango de días completos [00:00 del primero, 24:00 del último): los movimientos pueden estar guardados a cualquier hora del día. */
const dayRange = (minDate: string, maxDate: string) => ({ gte: new Date(`${minDate}T00:00:00.000Z`), lt: new Date(new Date(`${maxDate}T00:00:00.000Z`).getTime() + 86_400_000) });

const issue = (e: { issues: { message: string }[] }) => e.issues[0]?.message ?? 'Datos no válidos';

/** Ejecuta una operación de servicio convirtiendo ServiceError en resultado. Otros errores se propagan. */
export async function run<T>(fn: () => Promise<T>): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try { return { ok: true, data: await fn() }; }
  catch (e) { if (e instanceof ServiceError) return { ok: false, error: e.message }; throw e; }
}

// ───────────── Movimientos ─────────────
export async function createTransaction(userId: string, input: unknown) {
  const p = transactionSchema.safeParse(input);
  if (!p.success) return fail(issue(p.error));
  const d = p.data;
  return db.$transaction(async (tx) => {
    await requireAccountAccess(tx, userId, d.accountId);
    const row = await tx.transaction.create({ data: { userId, accountId: d.accountId, date: toDate(d.date), amount: d.amount, category: d.category, description: d.description, merchant: d.merchant, recurring: d.recurring, upcoming: d.upcoming } });
    await audit(tx, { userId, entity: 'Transaction', entityId: row.id, action: 'create', after: row });
    return row.id;
  });
}

export async function updateTransaction(userId: string, id: string, input: unknown) {
  const p = transactionSchema.safeParse(input);
  if (!p.success) return fail(issue(p.error));
  const d = p.data;
  return db.$transaction(async (tx) => {
    const before = await tx.transaction.findFirst({ where: { id, account: accessibleAccountsWhere(userId) } });
    if (!before) return fail('Movimiento no encontrado');
    if (d.accountId !== before.accountId) await requireAccountAccess(tx, userId, d.accountId);
    const after = await tx.transaction.update({ where: { id }, data: { accountId: d.accountId, date: toDate(d.date), amount: d.amount, category: d.category, description: d.description, merchant: d.merchant ?? null, recurring: d.recurring, upcoming: d.upcoming } });
    await audit(tx, { userId, entity: 'Transaction', entityId: id, action: 'update', before, after });
    return id;
  });
}

export async function deleteTransaction(userId: string, id: string) {
  return db.$transaction(async (tx) => {
    const before = await tx.transaction.findFirst({ where: { id, account: accessibleAccountsWhere(userId) } });
    if (!before) return fail('Movimiento no encontrado');
    await tx.transaction.delete({ where: { id } });
    await audit(tx, { userId, entity: 'Transaction', entityId: id, action: 'delete', before });
    return id;
  });
}

// ───────────── Importación CSV ─────────────
/** Claves de movimientos existentes de la cuenta en el rango de fechas dado (para detectar duplicados). */
export async function existingKeys(userId: string, accountId: string, minDate: string, maxDate: string): Promise<string[]> {
  await requireAccountAccess(db, userId, accountId);
  const rows = await db.transaction.findMany({
    where: { accountId, date: dayRange(minDate, maxDate) },
    select: { date: true, amount: true, description: true },
  });
  return rows.map((r) => dedupeKey(r.date.toISOString().slice(0, 10), toNumber(r.amount), r.description));
}

/** Marca duplicados en el servidor (nunca se confía en lo que diga el cliente). */
export async function previewDuplicates(userId: string, accountId: string, rows: ImportRow[]): Promise<ImportRow[]> {
  const dates = rows.filter((r) => r.date && !r.error).map((r) => r.date!).sort();
  if (dates.length === 0) return rows;
  return markDuplicates(rows, await existingKeys(userId, accountId, dates[0]!, dates[dates.length - 1]!));
}

export async function importTransactions(userId: string, input: unknown) {
  const p = importSchema.safeParse(input);
  if (!p.success) return fail(issue(p.error));
  const { accountId, skipDuplicates } = p.data;
  const rows: { date: string; amount: number; category: string; description: string }[] = [];
  for (const [i, raw] of p.data.rows.entries()) {
    const r = importRowSchema.safeParse(raw);
    if (!r.success) return fail(`Fila ${i + 1}: ${issue(r.error)}`);
    rows.push(r.data);
  }
  return db.$transaction(async (tx) => {
    await requireAccountAccess(tx, userId, accountId);
    let toInsert = rows;
    let skipped = 0;
    if (skipDuplicates) {
      const sorted = rows.map((r) => r.date).sort();
      const existing = await tx.transaction.findMany({ where: { accountId, date: dayRange(sorted[0]!, sorted[sorted.length - 1]!) }, select: { date: true, amount: true, description: true } });
      const marked = markDuplicates(rows.map((r, i) => ({ line: i, date: r.date, amount: r.amount, description: r.description, category: r.category })), existing.map((e) => dedupeKey(e.date.toISOString().slice(0, 10), toNumber(e.amount), e.description)));
      toInsert = rows.filter((_, i) => !marked[i]!.duplicate);
      skipped = rows.length - toInsert.length;
    }
    if (toInsert.length === 0) return { imported: 0, skipped };
    const created = await tx.transaction.createManyAndReturn({
      data: toInsert.map((r) => ({ userId, accountId, date: toDate(r.date), amount: r.amount, category: r.category, description: r.description, source: 'csv' })),
    });
    await audit(tx, created.map((row) => ({ userId, entity: 'Transaction' as const, entityId: row.id, action: 'create' as const, after: row })));
    return { imported: created.length, skipped };
  });
}

// ───────────── Cuentas ─────────────
export async function createAccount(userId: string, input: unknown) {
  const p = accountSchema.safeParse(input);
  if (!p.success) return fail(issue(p.error));
  return db.$transaction(async (tx) => {
    const row = await tx.bankAccount.create({ data: { ownerId: userId, name: p.data.name, kind: p.data.kind, openingBalance: p.data.openingBalance } });
    await audit(tx, { userId, entity: 'BankAccount', entityId: row.id, action: 'create', after: row });
    return row.id;
  });
}

export async function updateAccount(userId: string, id: string, input: unknown) {
  const p = accountSchema.safeParse(input);
  if (!p.success) return fail(issue(p.error));
  return db.$transaction(async (tx) => {
    const before = await requireAccountOwner(tx, userId, id);
    const after = await tx.bankAccount.update({ where: { id }, data: { name: p.data.name, kind: p.data.kind, openingBalance: p.data.openingBalance } });
    await audit(tx, { userId, entity: 'BankAccount', entityId: id, action: 'update', before, after });
    return id;
  });
}

/** Elimina la cuenta y sus movimientos. La auditoría conserva el estado previo y el nº de movimientos borrados. */
export async function deleteAccount(userId: string, id: string) {
  return db.$transaction(async (tx) => {
    const before = await requireAccountOwner(tx, userId, id);
    const count = await tx.transaction.count({ where: { accountId: id } });
    await tx.bankAccount.delete({ where: { id } });
    await audit(tx, { userId, entity: 'BankAccount', entityId: id, action: 'delete', before: { ...before, deletedTransactions: count } });
    return { id, deletedTransactions: count };
  });
}

/** Comparte una cuenta con otro usuario registrado (crea el hogar si hace falta). Solo el propietario. */
export async function shareAccount(userId: string, input: unknown) {
  const p = shareSchema.safeParse(input);
  if (!p.success) return fail(issue(p.error));
  return db.$transaction(async (tx) => {
    const acc = await requireAccountOwner(tx, userId, p.data.accountId);
    const target = await tx.user.findUnique({ where: { email: p.data.email }, select: { id: true, name: true } });
    if (!target) return fail('No hay ningún usuario registrado con ese email');
    if (target.id === userId) return fail('Ya eres el propietario de esta cuenta');
    let householdId = acc.householdId;
    if (!householdId) {
      const existing = await tx.householdMember.findFirst({ where: { userId, role: 'owner' }, select: { householdId: true } });
      householdId = existing?.householdId ?? (await tx.household.create({ data: { name: 'Hogar', members: { create: { userId, role: 'owner' } } } })).id;
    }
    await tx.householdMember.upsert({ where: { householdId_userId: { householdId, userId: target.id } }, update: {}, create: { householdId, userId: target.id } });
    const after = await tx.bankAccount.update({ where: { id: acc.id }, data: { householdId } });
    await audit(tx, { userId, entity: 'BankAccount', entityId: acc.id, action: 'update', before: acc, after: { ...after, sharedWith: target.id } });
    return { sharedWith: target.name };
  });
}

/** Deja de compartir la cuenta (los demás miembros pierden el acceso a ella). Solo el propietario. */
export async function unshareAccount(userId: string, accountId: string) {
  return db.$transaction(async (tx) => {
    const before = await requireAccountOwner(tx, userId, accountId);
    if (!before.householdId) return fail('La cuenta no está compartida');
    const after = await tx.bankAccount.update({ where: { id: accountId }, data: { householdId: null } });
    await audit(tx, { userId, entity: 'BankAccount', entityId: accountId, action: 'update', before, after });
    return accountId;
  });
}

// ───────────── Presupuestos ─────────────
/** Fija el presupuesto mensual de una categoría; 0 lo elimina. */
export async function setBudget(userId: string, input: unknown) {
  const p = budgetSchema.safeParse(input);
  if (!p.success) return fail(issue(p.error));
  return db.$transaction(async (tx) => {
    const before = await tx.budget.findUnique({ where: { userId_category: { userId, category: p.data.category } } });
    if (p.data.monthly === 0) {
      if (before) { await tx.budget.delete({ where: { id: before.id } }); await audit(tx, { userId, entity: 'Budget', entityId: before.id, action: 'delete', before }); }
      return null;
    }
    const after = await tx.budget.upsert({ where: { userId_category: { userId, category: p.data.category } }, update: { monthly: p.data.monthly }, create: { userId, category: p.data.category, monthly: p.data.monthly } });
    await audit(tx, { userId, entity: 'Budget', entityId: after.id, action: before ? 'update' : 'create', before, after });
    return after.id;
  });
}
