/** Cálculos financieros/inversión puros (sin acceso a BD) para poder testearlos. Se opera en céntimos enteros. */
import { fromCents, round2, toCents } from '@/lib/finance';

export interface TxLite { date: Date; amount: number; category: string }

const ym = (d: Date) => d.getFullYear() * 12 + d.getMonth();

export function monthSummary(txs: TxLite[], month: Date) {
  let income = 0, expenses = 0;
  const byCat = new Map<string, number>();
  for (const t of txs) {
    if (ym(t.date) !== ym(month)) continue;
    const c = toCents(t.amount);
    if (c >= 0) income += c;
    else { expenses += -c; byCat.set(t.category, (byCat.get(t.category) ?? 0) + -c); }
  }
  return {
    income: fromCents(income), expenses: fromCents(expenses), saving: fromCents(income - expenses),
    savingRate: income > 0 ? (income - expenses) / income : 0,
    byCategory: [...byCat].map(([category, c]) => ({ category, amount: fromCents(c) })).sort((a, b) => b.amount - a.amount),
  };
}

export function monthlySeries(txs: TxLite[], now: Date, months = 6) {
  return Array.from({ length: months }, (_, i) => {
    const m = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
    const s = monthSummary(txs, m);
    return {
      key: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`,
      month: m.toLocaleDateString('es-ES', { month: 'short' }).replace('.', ''),
      income: Math.round(s.income), expenses: Math.round(s.expenses), saving: Math.round(s.saving),
    };
  });
}

export type BudgetStatus = 'ok' | 'warn' | 'over';
export interface BudgetRow { category: string; budget: number; spent: number; pct: number; remaining: number; status: BudgetStatus }

/** Uso de presupuestos: ≥80% aviso, ≥100% superado. Ordenado de más a menos consumido. Sin presupuesto no hay fila. */
export function budgetUsage(budgets: { category: string; monthly: number }[], byCategory: { category: string; amount: number }[]): BudgetRow[] {
  const spent = new Map(byCategory.map((c) => [c.category, c.amount]));
  return budgets
    .filter((b) => b.monthly > 0)
    .map((b) => {
      const s = spent.get(b.category) ?? 0;
      const pct = s / b.monthly;
      return { category: b.category, budget: b.monthly, spent: s, pct, remaining: round2(b.monthly - s), status: (pct >= 1 ? 'over' : pct >= 0.8 ? 'warn' : 'ok') as BudgetStatus };
    })
    .sort((a, b) => b.pct - a.pct);
}

export interface PositionLite { symbol: string; assetType: string; quantity: number; avgCost: number; currentPrice: number; dividendYield: number }

export function portfolioStats(positions: PositionLite[]) {
  const rows = positions.map((p) => {
    const value = p.quantity * p.currentPrice;
    const cost = p.quantity * p.avgCost;
    return { ...p, value, cost, pnl: value - cost, pnlPct: cost > 0 ? (value - cost) / cost : 0, annualDividend: value * (p.dividendYield / 100) };
  });
  const value = rows.reduce((a, r) => a + r.value, 0);
  const cost = rows.reduce((a, r) => a + r.cost, 0);
  const allocation = new Map<string, number>();
  for (const r of rows) allocation.set(r.assetType, (allocation.get(r.assetType) ?? 0) + r.value);
  return {
    rows, value, cost, pnl: value - cost, pnlPct: cost > 0 ? (value - cost) / cost : 0,
    annualDividends: rows.reduce((a, r) => a + r.annualDividend, 0),
    allocation: [...allocation].map(([type, v]) => ({ type, value: v, pct: value > 0 ? v / value : 0 })).sort((a, b) => b.value - a.value),
  };
}

/** Dividendos cobrados por mes en los últimos `months` meses (incluye meses a 0 para que la gráfica sea continua). */
export function dividendsByMonth(dividends: { date: Date; amount: number }[], now: Date, months = 12) {
  return Array.from({ length: months }, (_, i) => {
    const m = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
    const cents = dividends.filter((d) => ym(d.date) === ym(m)).reduce((a, d) => a + toCents(d.amount), 0);
    return { key: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`, month: m.toLocaleDateString('es-ES', { month: 'short' }).replace('.', ''), amount: fromCents(cents) };
  });
}

/** Rentabilidad de la serie de instantáneas: variación del valor frente a lo aportado. Ignora aportaciones al calcular % no es posible sin flujos; se informa valor vs coste. */
export function evolutionSeries(snaps: { date: Date; value: number; cost: number }[]) {
  return [...snaps].sort((a, b) => a.date.getTime() - b.date.getTime()).map((s) => ({ date: s.date.toISOString().slice(0, 10), value: round2(s.value), cost: round2(s.cost) }));
}
