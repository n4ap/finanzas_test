import { describe, expect, it } from 'vitest';
import { rankNews, shortSummary, topOfToday } from './news-rank';

const now = new Date(2026, 9, 5, 12, 0);
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);
const a = (id: string, category: string, importance: number, h: number) => ({ id, category, importance, publishedAt: hoursAgo(h) });

describe('rankNews', () => {
  it('las categorías seguidas suben posiciones', () => {
    const items = [a('x', 'mundo', 70, 1), a('y', 'ia', 60, 1)];
    expect(rankNews(items, [], now)[0]!.id).toBe('x');
    expect(rankNews(items, ['ia'], now)[0]!.id).toBe('y');
  });
  it('la frescura desempata', () => {
    expect(rankNews([a('viejo', 'ia', 70, 20), a('nuevo', 'ia', 70, 1)], [], now)[0]!.id).toBe('nuevo');
  });
});

describe('topOfToday', () => {
  const items = [a('1', 'ia', 90, 1), a('2', 'ia', 85, 2), a('3', 'ia', 80, 3), a('4', 'mundo', 50, 1), a('5', 'economia', 60, 2), a('6', 'deportes', 40, 1), a('7', 'espana', 30, 1), a('old', 'mundo', 99, 48)];
  it('máximo 5, máximo 2 por categoría y descarta lo antiguo', () => {
    const top = topOfToday(items, [], now);
    expect(top).toHaveLength(5);
    expect(top.filter((x) => x.category === 'ia')).toHaveLength(2);
    expect(top.some((x) => x.id === 'old')).toBe(false);
  });
  it('devuelve menos de 5 si no hay suficientes', () => {
    expect(topOfToday([a('1', 'ia', 90, 1)], [], now)).toHaveLength(1);
  });
});

describe('shortSummary', () => {
  it('toma la primera frase', () => {
    expect(shortSummary('Primera frase. Segunda frase.')).toBe('Primera frase.');
  });
  it('recorta frases largas sin partir palabras', () => {
    const s = shortSummary('Las ' + 'palabras '.repeat(40) + 'terminan aquí.', 100);
    expect(s.length).toBeLessThanOrEqual(100);
    expect(s.endsWith('…')).toBe(true);
    expect(s).not.toMatch(/pala…$/);
  });
});
