/** Cálculos financieros/inversión puros (sin acceso a BD) para poder testearlos. */
export interface TxLite { date: Date; amount: number; category: string }

const ym = (d: Date) => d.getFullYear() * 12 + d.getMonth();

export function monthSummary(txs: TxLite[], month: Date) {
  let income = 0, expenses = 0;
  const byCategory = new Map<string, number>();
  for (const t of txs) {
    if (ym(t.date) !== ym(month)) continue;
    if (t.amount >= 0) income += t.amount;
    else { expenses += -t.amount; byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + -t.amount); }
  }
  return {
    income, expenses, saving: income - expenses,
    savingRate: income > 0 ? (income - expenses) / income : 0,
    byCategory: [...byCategory].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
  };
}

export function monthlySeries(txs: TxLite[], now: Date, months = 6) {
  return Array.from({ length: months }, (_, i) => {
    const m = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
    const s = monthSummary(txs, m);
    return { month: m.toLocaleDateString('es-ES', { month: 'short' }), income: Math.round(s.income), expenses: Math.round(s.expenses), saving: Math.round(s.saving) };
  });
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
