import { describe, expect, it } from 'vitest';
import { dateOnlyToDate, dateToDateOnly, nextOccurrence, parseTags } from './tasks';

const d = (s: string) => dateOnlyToDate(s);

describe('nextOccurrence', () => {
  it('diaria y semanal', () => {
    expect(dateToDateOnly(nextOccurrence(d('2026-10-04'), 'daily'))).toBe('2026-10-05');
    expect(dateToDateOnly(nextOccurrence(d('2026-10-04'), 'weekly'))).toBe('2026-10-11');
  });
  it('mensual ajusta fines de mes y cambio de año', () => {
    expect(dateToDateOnly(nextOccurrence(d('2026-01-31'), 'monthly'))).toBe('2026-02-28');
    expect(dateToDateOnly(nextOccurrence(d('2026-12-15'), 'monthly'))).toBe('2027-01-15');
    expect(dateToDateOnly(nextOccurrence(d('2028-01-31'), 'monthly'))).toBe('2028-02-29');
  });
});

describe('parseTags', () => {
  it('normaliza, deduplica y limita', () => {
    expect(parseTags('#Dev, dev  Casa,,')).toEqual(['dev', 'casa']);
    expect(parseTags(Array.from({ length: 20 }, (_, i) => `t${i}`).join(','))).toHaveLength(10);
  });
});

describe('dateOnly', () => {
  it('ida y vuelta sin desfase', () => {
    expect(dateToDateOnly(dateOnlyToDate('2026-03-01'))).toBe('2026-03-01');
    expect(dateToDateOnly(null)).toBe('');
  });
});
