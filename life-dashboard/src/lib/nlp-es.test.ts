import { describe, expect, it } from 'vitest';
import { parseWhen } from './nlp-es';
import { addDaysKey, dayBoundsUtc, localKey, localToUtc, clampOffset } from './tz';

// Lunes 5 oct 2026, 08:00 en Madrid (UTC+2 → offset −120) = 06:00 UTC
const NOW = new Date('2026-10-05T06:00:00Z');
const OFF = -120;
const w = (t: string) => parseWhen(t, NOW, OFF);

describe('tz', () => {
  it('día local distinto del UTC cerca de medianoche', () => {
    const lateUtc = new Date('2026-10-05T23:30:00Z'); // 01:30 del 6 en Madrid
    expect(localKey(lateUtc, OFF)).toBe('2026-10-06');
    expect(localKey(lateUtc, 0)).toBe('2026-10-05');
  });
  it('localToUtc y límites del día', () => {
    expect(localToUtc('2026-10-06', '10:00', OFF).toISOString()).toBe('2026-10-06T08:00:00.000Z');
    expect(dayBoundsUtc('2026-10-06', OFF).from.toISOString()).toBe('2026-10-05T22:00:00.000Z');
    expect(addDaysKey('2026-12-31', 1)).toBe('2027-01-01');
  });
  it('clampOffset rechaza valores absurdos', () => { expect(clampOffset(99999)).toBe(0); expect(clampOffset('x')).toBe(0); expect(clampOffset(-120)).toBe(-120); });
});

describe('parseWhen', () => {
  it('hoy, mañana, pasado mañana', () => {
    expect(w('llamar al dentista mañana').dateKey).toBe('2026-10-06');
    expect(w('llamar al dentista mañana').rest).toBe('llamar al dentista');
    expect(w('pasado mañana revisar').dateKey).toBe('2026-10-07');
    expect(w('hoy comprar pan').dateKey).toBe('2026-10-05');
  });
  it('«por la mañana» no es «mañana»', () => {
    const r = w('gimnasio por la mañana');
    expect(r.dateKey).toBe('2026-10-05');
    expect(r.time).toBe('09:00');
  });
  it('horas: a las 10, 10:30, 5 de la tarde', () => {
    expect(w('reunión mañana a las 10').time).toBe('10:00');
    expect(w('cena el viernes a las 21:15').time).toBe('21:15');
    expect(w('café mañana a las 5 de la tarde').time).toBe('17:00');
    expect(w('reunión a las 25').time).toBeUndefined();
  });
  it('día de la semana: siempre el siguiente, incluso si hoy es ese día', () => {
    expect(w('el viernes comida').dateKey).toBe('2026-10-09');
    expect(w('el lunes comida').dateKey).toBe('2026-10-12');
    expect(w('este domingo').dateKey).toBe('2026-10-11');
  });
  it('en N días/semanas', () => {
    expect(w('en 3 días').dateKey).toBe('2026-10-08');
    expect(w('en 2 semanas').dateKey).toBe('2026-10-19');
  });
  it('fechas numéricas y con mes; pasadas saltan al año siguiente; inválidas se ignoran', () => {
    expect(w('el 15/11').dateKey).toBe('2026-11-15');
    expect(w('el 1/3').dateKey).toBe('2027-03-01');
    expect(w('el 15 de noviembre').dateKey).toBe('2026-11-15');
    expect(w('el 31/02').dateKey).toBeUndefined();
    expect(w('el 12/12/2027').dateKey).toBe('2027-12-12');
  });
  it('sin fecha ni hora devuelve el texto tal cual', () => {
    expect(w('comprar leche')).toEqual({ dateKey: undefined, time: undefined, rest: 'comprar leche' });
  });
});
