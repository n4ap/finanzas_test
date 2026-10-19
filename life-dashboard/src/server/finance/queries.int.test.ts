import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { createInvestment, addDividend } from './investments';
import { getFinanceOverview, getInvestmentsOverview } from './queries';
import { createAccount, createTransaction, setBudget, shareAccount, updateTransaction } from './service';

let alice: string, bob: string, carol: string;
const NOW = new Date(2026, 9, 15, 12);
const params = { month: '2026-10', page: 1 };
const tx = (accountId: string, o: Record<string, unknown> = {}) => ({ accountId, date: '2026-10-05', amount: -10, category: 'ocio', description: 'Algo', ...o });

beforeEach(async () => {
  await db.user.deleteMany();
  await db.household.deleteMany();
  const mk = (n: string) => db.user.create({ data: { email: `${n}@test.dev`, name: n, passwordHash: 'x' } }).then((u) => u.id);
  [alice, bob, carol] = [await mk('alice'), await mk('bob'), await mk('carol')];
});

describe('getFinanceOverview', () => {
  it('calcula saldos exactos en céntimos y excluye los pagos previstos', async () => {
    const acc = await createAccount(alice, { name: 'Corriente', kind: 'checking', openingBalance: 100.1 });
    await createTransaction(alice, tx(acc, { amount: -0.2 }));
    await createTransaction(alice, tx(acc, { amount: 2000, category: 'ingresos', description: 'Nómina' }));
    await createTransaction(alice, tx(acc, { amount: -500, upcoming: true, date: '2026-10-20' }));
    const o = await getFinanceOverview(alice, params, NOW);
    expect(o.accounts[0]!.balance).toBe(2099.9);
    expect(o.summary).toMatchObject({ income: 2000, expenses: 0.2 });
    expect(o.upcoming).toHaveLength(1);
  });
  it('aislamiento: cada usuario solo ve lo suyo', async () => {
    const acc = await createAccount(alice, { name: 'Alice', kind: 'checking' });
    await createTransaction(alice, tx(acc));
    await setBudget(alice, { category: 'ocio', monthly: 50 });
    const o = await getFinanceOverview(carol, params, NOW);
    expect(o.accounts).toHaveLength(0);
    expect(o.transactions.total).toBe(0);
    expect(o.budgets).toHaveLength(0);
    expect(o.audit).toHaveLength(0);
  });
  it('la cuenta compartida aparece a ambos, con quién la comparte y los cambios de la pareja en el historial', async () => {
    const acc = await createAccount(alice, { name: 'Conjunta', kind: 'checking' });
    const id = await createTransaction(alice, tx(acc));
    await shareAccount(alice, { accountId: acc, email: 'bob@test.dev' });
    await updateTransaction(bob, id, tx(acc, { amount: -99 }));
    const forAlice = await getFinanceOverview(alice, params, NOW);
    const forBob = await getFinanceOverview(bob, params, NOW);
    expect(forAlice.accounts[0]).toMatchObject({ shared: true, isOwner: true, sharedWith: ['bob'] });
    expect(forBob.accounts[0]).toMatchObject({ shared: true, isOwner: false, sharedWith: ['alice'] });
    expect(forBob.transactions.items[0]!.amount).toBe(-99);
    expect(forAlice.audit.some((a) => a.by === 'bob' && a.action === 'update')).toBe(true); // Alice ve lo que editó Bob
    expect((await getFinanceOverview(carol, params, NOW)).accounts).toHaveLength(0);
  });
  it('filtra por categoría, búsqueda y cuenta, y pagina', async () => {
    const a1 = await createAccount(alice, { name: 'A1', kind: 'checking' });
    const a2 = await createAccount(alice, { name: 'A2', kind: 'checking' });
    for (let i = 0; i < 45; i++) await createTransaction(alice, tx(a1, { description: `Compra ${i}`, category: i % 2 ? 'compras' : 'ocio' }));
    await createTransaction(alice, tx(a2, { description: 'Especial', merchant: 'Tienda X' }));
    const all = await getFinanceOverview(alice, params, NOW);
    expect(all.transactions).toMatchObject({ total: 46, pageSize: 40 });
    expect(all.transactions.items).toHaveLength(40);
    expect((await getFinanceOverview(alice, { ...params, page: 2 }, NOW)).transactions.items).toHaveLength(6);
    expect((await getFinanceOverview(alice, { ...params, category: 'compras' }, NOW)).transactions.total).toBe(22);
    expect((await getFinanceOverview(alice, { ...params, q: 'tienda x' }, NOW)).transactions.items.map((t) => t.description)).toEqual(['Especial']);
    expect((await getFinanceOverview(alice, { ...params, accountId: a2 }, NOW)).transactions.total).toBe(1);
    // una cuenta ajena en el filtro se ignora (no filtra ni filtra datos)
    const other = await createAccount(bob, { name: 'Bob', kind: 'checking' });
    await createTransaction(bob, tx(other, { description: 'Secreto de Bob' }));
    expect((await getFinanceOverview(alice, { ...params, accountId: other }, NOW)).transactions.items.some((t) => t.description === 'Secreto de Bob')).toBe(false);
  });
  it('en el mes en curso se compara con el MISMO punto del mes anterior; en meses cerrados, con el mes completo', async () => {
    const acc = await createAccount(alice, { name: 'A', kind: 'checking' });
    await createTransaction(alice, tx(acc, { date: '2026-09-03', amount: -100 }));   // antes del día 15 → cuenta
    await createTransaction(alice, tx(acc, { date: '2026-09-25', amount: -400 }));   // después del día 15 → no cuenta
    await createTransaction(alice, tx(acc, { date: '2026-10-05', amount: -50 }));
    const cur = await getFinanceOverview(alice, params, NOW); // NOW = 15-oct-2026, mes en curso
    expect(cur.prev).toMatchObject({ expenses: 100, samePeriod: true });
    expect(cur.series.at(-1)!.partial).toBe(true);
    const closed = await getFinanceOverview(alice, { ...params, month: '2026-09' }, NOW);
    expect(closed.prev.samePeriod).toBe(false);
    expect(closed.series.every((m) => !m.partial)).toBe(true);
    expect(closed.summary.expenses).toBe(500);
  });
  it('presupuestos: gasto del mes frente al límite', async () => {
    const acc = await createAccount(alice, { name: 'A', kind: 'checking' });
    await createTransaction(alice, tx(acc, { amount: -85, category: 'ocio' }));
    await setBudget(alice, { category: 'ocio', monthly: 100 });
    expect((await getFinanceOverview(alice, params, NOW)).budgets[0]).toMatchObject({ category: 'ocio', spent: 85, status: 'warn' });
  });
});

describe('getInvestmentsOverview', () => {
  it('valor, rentabilidad, dividendos y distribución; sin datos ajenos', async () => {
    const id = await createInvestment(alice, { assetType: 'etf', symbol: 'VWCE', name: 'Vanguard', quantity: 10, avgCost: 100, currentPrice: 110, dividendYield: 2 });
    await addDividend(alice, { investmentId: id, date: '2026-10-01', amount: 7.5 });
    const o = await getInvestmentsOverview(alice, NOW);
    expect(o.totals).toMatchObject({ value: 1100, cost: 1000, pnl: 100 });
    expect(o.totals.annualDividends).toBeCloseTo(22);
    expect(o.dividendsReceived12).toBe(7.5);
    expect(o.evolution).toHaveLength(1);
    expect(o.allocation[0]).toMatchObject({ type: 'etf', pct: 1 });
    const empty = await getInvestmentsOverview(bob, NOW);
    expect(empty.positions).toHaveLength(0);
    expect(empty.evolution).toHaveLength(0);
  });
});
