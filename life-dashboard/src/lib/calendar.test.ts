import { describe, expect, it } from 'vitest';
import { layoutDay, shiftDate, startOfWeek, viewRange } from './calendar';

const d = (day: number, h = 0, m = 0) => new Date(2026, 9, day, h, m);
const ev = (id: string, s: Date, e: Date) => ({ id, start: s, end: e });

describe('rangos de vista', () => {
  it('la semana empieza en lunes', () => {
    expect(startOfWeek(d(4)).getDate()).toBe(28); // domingo 4/10/2026 → lunes 28/09
    expect(viewRange('week', d(7)).from.getDate()).toBe(5);
  });
  it('el mes cubre semanas completas', () => {
    const { from, to } = viewRange('month', d(15));
    expect(from.getDay()).toBe(1);
    // Días naturales (redondeando): un mes con cambio de hora (DST) mide ±1 h en milisegundos.
    expect(Math.round((to.getTime() - from.getTime()) / 86_400_000) % 7).toBe(0);
    expect(from <= new Date(2026, 9, 1) && to > new Date(2026, 9, 31)).toBe(true);
  });
  it('shiftDate mueve por unidad de vista', () => {
    expect(shiftDate('month', d(31), 1).getMonth()).toBe(10);
    expect(shiftDate('week', d(1), -1).getDate()).toBe(24);
  });
});

describe('layoutDay', () => {
  it('eventos solapados comparten ancho y los consecutivos no', () => {
    const p = layoutDay([ev('a', d(5, 10), d(5, 11)), ev('b', d(5, 10, 30), d(5, 12)), ev('c', d(5, 12), d(5, 13))], d(5));
    const by = Object.fromEntries(p.map((x) => [x.item.id, x]));
    expect(by.a!.cols).toBe(2);
    expect(by.b!.cols).toBe(2);
    expect(by.a!.col).not.toBe(by.b!.col);
    expect(by.c!.cols).toBe(1);
  });
  it('recorta eventos que cruzan medianoche y excluye otros días', () => {
    const p = layoutDay([ev('n', d(5, 23), d(6, 2)), ev('x', d(7, 9), d(7, 10))], d(5));
    expect(p).toHaveLength(1);
    expect(p[0]!.top + p[0]!.height).toBeCloseTo(100);
  });
  it('da altura mínima a eventos de duración cero', () => {
    expect(layoutDay([ev('z', d(5, 9), d(5, 9))], d(5))[0]!.height).toBeGreaterThan(0);
  });
});
