import { describe, expect, it } from 'vitest';
import { budgetUsage, dividendsByMonth, evolutionSeries, monthSummary, monthlySeries, portfolioStats } from './metrics';

const d = (m: number, day = 1) => new Date(2026, m, day);

describe('monthSummary', () => {
  it('separa ingresos y gastos y agrupa por categoría', () => {
    const s = monthSummary([
      { date: d(9), amount: 2000, category: 'ingresos' },
      { date: d(9, 3), amount: -500, category: 'vivienda' },
      { date: d(9, 4), amount: -100, category: 'ocio' },
      { date: d(8), amount: -999, category: 'ocio' },
    ], d(9));
    expect(s).toMatchObject({ income: 2000, expenses: 600, saving: 1400 });
    expect(s.byCategory[0]).toEqual({ category: 'vivienda', amount: 500 });
    expect(s.savingRate).toBeCloseTo(0.7);
  });
  it('no divide por cero sin ingresos', () => {
    expect(monthSummary([], d(9)).savingRate).toBe(0);
  });
});

describe('monthlySeries', () => {
  it('devuelve N meses ordenados cronológicamente', () => {
    const s = monthlySeries([{ date: d(9), amount: -50, category: 'ocio' }], d(9, 15), 3);
    expect(s).toHaveLength(3);
    expect(s[2]?.expenses).toBe(50);
  });
});

describe('portfolioStats', () => {
  it('calcula valor, rentabilidad, dividendos y distribución', () => {
    const p = portfolioStats([
      { symbol: 'A', assetType: 'etf', quantity: 10, avgCost: 100, currentPrice: 110, dividendYield: 2 },
      { symbol: 'B', assetType: 'crypto', quantity: 1, avgCost: 100, currentPrice: 90, dividendYield: 0 },
    ]);
    expect(p.value).toBe(1190);
    expect(p.pnl).toBe(90);
    expect(p.annualDividends).toBeCloseTo(22);
    expect(p.allocation[0]?.type).toBe('etf');
    expect(p.allocation.reduce((a, x) => a + x.pct, 0)).toBeCloseTo(1);
  });
});

describe('precisión en céntimos', () => {
  it('sumar 10 gastos de 0,10 € da exactamente 1 €', () => {
    const txs = Array.from({ length: 10 }, () => ({ date: d(9, 2), amount: -0.1, category: 'ocio' }));
    expect(monthSummary(txs, d(9)).expenses).toBe(1);
  });
});

describe('budgetUsage', () => {
  const by = [{ category: 'ocio', amount: 210 }, { category: 'alimentacion', amount: 340 }, { category: 'compras', amount: 50 }];
  it('calcula porcentaje, restante y estado (ok / aviso ≥80% / superado ≥100%)', () => {
    const r = budgetUsage([{ category: 'ocio', monthly: 200 }, { category: 'alimentacion', monthly: 400 }, { category: 'compras', monthly: 150 }, { category: 'viajes', monthly: 100 }], by);
    expect(r.map((x) => [x.category, x.status])).toEqual([['ocio', 'over'], ['alimentacion', 'warn'], ['compras', 'ok'], ['viajes', 'ok']]);
    expect(r[0]).toMatchObject({ spent: 210, remaining: -10 });
    expect(r[3]).toMatchObject({ spent: 0, pct: 0 });
  });
  it('ignora presupuestos a 0 y exactamente el 100% cuenta como superado', () => {
    expect(budgetUsage([{ category: 'ocio', monthly: 0 }], by)).toEqual([]);
    expect(budgetUsage([{ category: 'ocio', monthly: 210 }], by)[0]!.status).toBe('over');
  });
});

describe('dividendsByMonth y evolución', () => {
  it('agrupa por mes e incluye meses vacíos', () => {
    const r = dividendsByMonth([{ date: d(8, 15), amount: 10.1 }, { date: d(8, 20), amount: 0.2 }, { date: d(6, 1), amount: 5 }], d(9, 5), 4);
    // Jul, ago, sep, oct → 5 €, 0 €, 10,30 € (10,10 + 0,20 sumado en céntimos), 0 €
    expect(r.map((x) => x.amount)).toEqual([5, 0, 10.3, 0]);
  });
  it('ordena las instantáneas por fecha', () => {
    const e = evolutionSeries([{ date: new Date('2026-02-01'), value: 2, cost: 1 }, { date: new Date('2026-01-01'), value: 1, cost: 1 }]);
    expect(e.map((x) => x.date)).toEqual(['2026-01-01', '2026-02-01']);
  });
});
