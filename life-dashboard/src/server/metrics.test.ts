import { describe, expect, it } from 'vitest';
import { monthSummary, monthlySeries, portfolioStats } from './metrics';

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
