import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { addDividend, createInvestment, deleteInvestment, updateInvestment, updatePrice } from './investments';
import { createAccount, createTransaction, deleteAccount, deleteTransaction, importTransactions, previewDuplicates, setBudget, shareAccount, unshareAccount, updateTransaction } from './service';

// Tests de integración contra PostgreSQL real (BD de pruebas, ver vitest.config.mts).
let alice: string, bob: string, carol: string, aliceAcc: string;

const tx = (accountId: string, o: Record<string, unknown> = {}) => ({ accountId, date: '2026-10-01', amount: -25.5, category: 'ocio', description: 'Cena', ...o });
const audits = (entity: string, action?: string) => db.auditLog.findMany({ where: { entity, ...(action ? { action } : {}) }, orderBy: { createdAt: 'asc' } });

beforeEach(async () => {
  await db.user.deleteMany();
  await db.household.deleteMany();
  const mk = (n: string) => db.user.create({ data: { email: `${n}@test.dev`, name: n, passwordHash: 'x' } }).then((u) => u.id);
  [alice, bob, carol] = [await mk('alice'), await mk('bob'), await mk('carol')];
  aliceAcc = await createAccount(alice, { name: 'Corriente', kind: 'checking', openingBalance: 1000 });
});

describe('movimientos + auditoría', () => {
  it('crea un movimiento y deja rastro de auditoría con el estado posterior', async () => {
    const id = await createTransaction(alice, tx(aliceAcc));
    const [log] = await audits('Transaction', 'create');
    expect(log).toMatchObject({ userId: alice, entityId: id, action: 'create', before: null });
    expect((log!.after as { amount: string }).amount).toBe('-25.5');
  });
  it('update y delete guardan before/after', async () => {
    const id = await createTransaction(alice, tx(aliceAcc));
    await updateTransaction(alice, id, tx(aliceAcc, { amount: -30, description: 'Cena 2' }));
    await deleteTransaction(alice, id);
    const logs = await audits('Transaction');
    expect(logs.map((l) => l.action)).toEqual(['create', 'update', 'delete']);
    expect((logs[1]!.before as { amount: string }).amount).toBe('-25.5');
    expect((logs[1]!.after as { amount: string }).amount).toBe('-30');
    expect((logs[2]!.before as { description: string }).description).toBe('Cena 2');
    expect(await db.transaction.count()).toBe(0);
  });
  it('valida signo, importe y categoría', async () => {
    await expect(createTransaction(alice, tx(aliceAcc, { amount: 10 }))).rejects.toThrow(/ingresos deben ser positivos/);
    await expect(createTransaction(alice, tx(aliceAcc, { category: 'ingresos', amount: -10 }))).rejects.toThrow();
    await expect(createTransaction(alice, tx(aliceAcc, { amount: 0 }))).rejects.toThrow(/no puede ser 0/);
    await expect(createTransaction(alice, tx(aliceAcc, { amount: -1.005 }))).rejects.toThrow(/2 decimales/);
    await expect(createTransaction(alice, tx(aliceAcc, { category: 'inventada' }))).rejects.toThrow();
    await expect(createTransaction(alice, tx(aliceAcc, { date: '2026-02-31' }))).rejects.toThrow(/Fecha/);
    expect(await db.transaction.count()).toBe(0);
    expect(await db.auditLog.count({ where: { entity: 'Transaction' } })).toBe(0);
  });
  it('un usuario sin acceso no puede crear, editar ni borrar en cuentas ajenas', async () => {
    const id = await createTransaction(alice, tx(aliceAcc));
    await expect(createTransaction(bob, tx(aliceAcc))).rejects.toThrow(/no encontrada/);
    await expect(updateTransaction(bob, id, tx(aliceAcc, { amount: -1 }))).rejects.toThrow(/no encontrado/);
    await expect(deleteTransaction(bob, id)).rejects.toThrow(/no encontrado/);
    expect(await db.transaction.count()).toBe(1);
  });
  it('no se puede mover un movimiento a una cuenta ajena', async () => {
    const id = await createTransaction(alice, tx(aliceAcc));
    const bobAcc = await createAccount(bob, { name: 'Bob', kind: 'checking' });
    await expect(updateTransaction(alice, id, tx(bobAcc))).rejects.toThrow(/no encontrada/);
  });
});

describe('cuentas compartidas (dos usuarios)', () => {
  it('compartir da acceso al miembro y a nadie más; dejar de compartir lo revoca', async () => {
    const id = await createTransaction(alice, tx(aliceAcc));
    await shareAccount(alice, { accountId: aliceAcc, email: 'bob@test.dev' });
    // Bob ve y edita; Carol sigue sin acceso
    await updateTransaction(bob, id, tx(aliceAcc, { amount: -40 }));
    await createTransaction(bob, tx(aliceAcc, { description: 'Compra de Bob' }));
    await expect(deleteTransaction(carol, id)).rejects.toThrow();
    const logs = await audits('Transaction', 'update');
    expect(logs[0]!.userId).toBe(bob); // la auditoría registra QUIÉN hizo el cambio
    await unshareAccount(alice, aliceAcc);
    await expect(updateTransaction(bob, id, tx(aliceAcc))).rejects.toThrow();
  });
  it('solo el propietario puede compartir, editar o borrar la cuenta', async () => {
    await shareAccount(alice, { accountId: aliceAcc, email: 'bob@test.dev' });
    await expect(shareAccount(bob, { accountId: aliceAcc, email: 'carol@test.dev' })).rejects.toThrow(/propietario/);
    await expect(deleteAccount(bob, aliceAcc)).rejects.toThrow(/propietario/);
    await expect(unshareAccount(bob, aliceAcc)).rejects.toThrow(/propietario/);
  });
  it('rechaza emails inexistentes o el propio', async () => {
    await expect(shareAccount(alice, { accountId: aliceAcc, email: 'nadie@test.dev' })).rejects.toThrow(/ningún usuario/);
    await expect(shareAccount(alice, { accountId: aliceAcc, email: 'alice@test.dev' })).rejects.toThrow(/propietario/);
  });
  it('compartir dos veces con la misma persona es idempotente', async () => {
    await shareAccount(alice, { accountId: aliceAcc, email: 'bob@test.dev' });
    await shareAccount(alice, { accountId: aliceAcc, email: 'bob@test.dev' });
    expect(await db.householdMember.count({ where: { userId: bob } })).toBe(1);
  });
});

describe('importación CSV', () => {
  const rows = [
    { date: '2026-10-01', amount: -12.5, category: 'alimentacion', description: 'Mercadona' },
    { date: '2026-10-02', amount: 2650, category: 'ingresos', description: 'Nómina' },
    { date: '2026-10-03', amount: -2.5, category: 'ocio', description: 'Café' },
    { date: '2026-10-03', amount: -2.5, category: 'ocio', description: 'Café' },
  ];
  it('importa, audita cada fila y marca el origen csv', async () => {
    expect(await importTransactions(alice, { accountId: aliceAcc, rows })).toEqual({ imported: 4, skipped: 0 });
    expect(await db.transaction.count({ where: { source: 'csv' } })).toBe(4);
    expect((await audits('Transaction', 'create')).length).toBe(4);
  });
  it('reimportar el mismo archivo no duplica nada', async () => {
    await importTransactions(alice, { accountId: aliceAcc, rows });
    expect(await importTransactions(alice, { accountId: aliceAcc, rows })).toEqual({ imported: 0, skipped: 4 });
    expect(await db.transaction.count()).toBe(4);
  });
  it('si ya existía 1 café, importa solo el segundo (multiconjunto)', async () => {
    await createTransaction(alice, tx(aliceAcc, { date: '2026-10-03', amount: -2.5, category: 'ocio', description: 'café' }));
    expect(await importTransactions(alice, { accountId: aliceAcc, rows: rows.slice(2) })).toEqual({ imported: 1, skipped: 1 });
  });
  it('detecta duplicados aunque el existente esté guardado a otra hora del día (regresión)', async () => {
    await db.transaction.create({ data: { userId: alice, accountId: aliceAcc, date: new Date('2026-10-03T07:30:00.000Z'), amount: -12.5, category: 'alimentacion', description: 'MERCADONA' } });
    const r = await importTransactions(alice, { accountId: aliceAcc, rows: [{ date: '2026-10-03', amount: -12.5, category: 'alimentacion', description: 'Mercadona' }, { date: '2026-10-03', amount: -9, category: 'ocio', description: 'Otro' }] });
    expect(r).toEqual({ imported: 1, skipped: 1 });
    const preview = await previewDuplicates(alice, aliceAcc, [{ line: 2, date: '2026-10-03', amount: -12.5, description: 'mercadona', category: 'alimentacion' }]);
    expect(preview[0]!.duplicate).toBe(true);
  });
  it('skipDuplicates=false permite forzar la importación', async () => {
    await importTransactions(alice, { accountId: aliceAcc, rows });
    expect((await importTransactions(alice, { accountId: aliceAcc, rows, skipDuplicates: false })).imported).toBe(4);
  });
  it('es atómica: una fila inválida no importa nada y dice cuál es', async () => {
    await expect(importTransactions(alice, { accountId: aliceAcc, rows: [rows[0], { ...rows[1], amount: -5 }] })).rejects.toThrow(/Fila 2/);
    expect(await db.transaction.count()).toBe(0);
  });
  it('exige acceso a la cuenta y respeta el máximo de filas', async () => {
    await expect(importTransactions(bob, { accountId: aliceAcc, rows })).rejects.toThrow(/no encontrada/);
    await expect(importTransactions(alice, { accountId: aliceAcc, rows: Array.from({ length: 5001 }, () => rows[0]) })).rejects.toThrow(/5000/);
    await expect(importTransactions(alice, { accountId: aliceAcc, rows: [] })).rejects.toThrow();
  });
  it('previewDuplicates detecta en servidor lo ya existente', async () => {
    await importTransactions(alice, { accountId: aliceAcc, rows: rows.slice(0, 2) });
    const preview = await previewDuplicates(alice, aliceAcc, rows.map((r, i) => ({ ...r, line: i + 2 })));
    expect(preview.map((r) => !!r.duplicate)).toEqual([true, true, false, false]);
  });
});

describe('cuentas y presupuestos', () => {
  it('borrar una cuenta elimina sus movimientos y audita cuántos eran', async () => {
    await createTransaction(alice, tx(aliceAcc));
    await createTransaction(alice, tx(aliceAcc));
    expect(await deleteAccount(alice, aliceAcc)).toMatchObject({ deletedTransactions: 2 });
    expect(await db.transaction.count()).toBe(0);
    const [log] = await audits('BankAccount', 'delete');
    expect((log!.before as { deletedTransactions: number }).deletedTransactions).toBe(2);
  });
  it('presupuesto: crea, actualiza, elimina con 0 y valida categoría', async () => {
    await setBudget(alice, { category: 'ocio', monthly: 200 });
    await setBudget(alice, { category: 'ocio', monthly: 250 });
    expect(await db.budget.count({ where: { userId: alice } })).toBe(1);
    await setBudget(alice, { category: 'ocio', monthly: 0 });
    expect(await db.budget.count({ where: { userId: alice } })).toBe(0);
    expect((await audits('Budget')).map((l) => l.action)).toEqual(['create', 'update', 'delete']);
    await expect(setBudget(alice, { category: 'ingresos', monthly: 10 })).rejects.toThrow();
    await expect(setBudget(alice, { category: 'ocio', monthly: -5 })).rejects.toThrow(/negativo/);
  });
});

describe('inversiones', () => {
  const pos = { assetType: 'etf', symbol: 'vwce', name: 'Vanguard FTSE All-World', quantity: 10, avgCost: 100, currentPrice: 110, dividendYield: 1.6 };
  it('crea la cartera si no existe, normaliza el símbolo y guarda instantánea', async () => {
    const id = await createInvestment(alice, pos);
    expect((await db.investment.findUniqueOrThrow({ where: { id } })).symbol).toBe('VWCE');
    const [snap] = await db.portfolioSnapshot.findMany();
    expect([Number(snap!.value), Number(snap!.cost)]).toEqual([1100, 1000]);
  });
  it('actualizar el precio el mismo día sobrescribe la instantánea (una por día)', async () => {
    const id = await createInvestment(alice, pos);
    await updatePrice(alice, { investmentId: id, currentPrice: 120 });
    const snaps = await db.portfolioSnapshot.findMany();
    expect(snaps).toHaveLength(1);
    expect(Number(snaps[0]!.value)).toBe(1200);
    expect((await audits('Investment', 'update'))).toHaveLength(1);
  });
  it('otro usuario no puede ver, editar ni borrar mis posiciones', async () => {
    const id = await createInvestment(alice, pos);
    await expect(updateInvestment(bob, id, pos)).rejects.toThrow(/no encontrada/);
    await expect(updatePrice(bob, { investmentId: id, currentPrice: 1 })).rejects.toThrow();
    await expect(deleteInvestment(bob, id)).rejects.toThrow();
    await expect(addDividend(bob, { investmentId: id, date: '2026-09-01', amount: 5 })).rejects.toThrow();
  });
  it('valida cantidad, símbolo y tipo; registra dividendos y los borra en cascada', async () => {
    await expect(createInvestment(alice, { ...pos, quantity: 0 })).rejects.toThrow(/mayor que 0/);
    await expect(createInvestment(alice, { ...pos, symbol: 'a b!' })).rejects.toThrow(/Símbolo/);
    await expect(createInvestment(alice, { ...pos, assetType: 'bono' })).rejects.toThrow();
    const id = await createInvestment(alice, pos);
    await addDividend(alice, { investmentId: id, date: '2026-09-01', amount: 12.34 });
    expect(await db.dividend.count()).toBe(1);
    await deleteInvestment(alice, id);
    expect(await db.dividend.count()).toBe(0);
    expect((await audits('Investment')).map((l) => l.action)).toEqual(['create', 'delete']);
  });
});
