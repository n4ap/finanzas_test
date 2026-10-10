import { describe, expect, it } from 'vitest';
import { parseCsv } from './finance';
import { detectHealthColumns, parseHealthDate, parseHealthRows, parseSleepHours, parseSteps } from './health-import';
import { serialToTime } from './xlsx';

const TODAY = new Date(2026, 9, 10, 12);

describe('parseHealthDate', () => {
  it('formatos ISO, españoles e ingleses; sin año, el más reciente no futuro', () => {
    expect(parseHealthDate('2026-10-03', TODAY)).toBe('2026-10-03');
    expect(parseHealthDate('03/10/2026', TODAY)).toBe('2026-10-03');
    expect(parseHealthDate('3 oct 2026', TODAY)).toBe('2026-10-03');
    expect(parseHealthDate('3 de octubre de 2026', TODAY)).toBe('2026-10-03');
    expect(parseHealthDate('vie, 3 oct', TODAY)).toBe('2026-10-03');
    expect(parseHealthDate('Oct 3, 2026', TODAY)).toBe('2026-10-03');
    expect(parseHealthDate('Fri Oct 3', TODAY)).toBe('2026-10-03');
    expect(parseHealthDate('20 dic', TODAY)).toBe('2025-12-20');
    expect(parseHealthDate('Total', TODAY)).toBeNull();
  });
});

describe('parseSleepHours', () => {
  it('duraciones de Garmin', () => {
    expect(parseSleepHours('7h 32min')).toBeCloseTo(7.53, 2);
    expect(parseSleepHours('7 h 5 min')).toBeCloseTo(7.08, 2);
    expect(parseSleepHours('8h')).toBe(8);
    expect(parseSleepHours('45min')).toBe(0.75);
    expect(parseSleepHours('7:30')).toBe(7.5);
    expect(parseSleepHours('7,5')).toBe(7.5);
    expect(parseSleepHours('452')).toBeCloseTo(7.53, 2); // minutos
    expect(parseSleepHours('--')).toBeNull();
    expect(parseSleepHours('')).toBeNull();
    expect(parseSleepHours('30h')).toBeNull();
  });
  it('celdas de Excel con formato de hora llegan como «H:MM»', () => {
    expect(parseSleepHours(serialToTime(7.5 / 24))).toBe(7.5);
  });
});

describe('parseSteps', () => {
  it('miles con punto, coma o sin separador', () => {
    expect(parseSteps('9.123')).toBe(9123);
    expect(parseSteps('9,123')).toBe(9123);
    expect(parseSteps('12 345')).toBe(12345);
    expect(parseSteps('856')).toBe(856);
    expect(parseSteps('0')).toBeNull();
    expect(parseSteps('--')).toBeNull();
    expect(parseSteps('9,5')).toBeNull();
  });
});

describe('detectHealthColumns', () => {
  it('pasos: ignora la columna del objetivo; fecha sin título como primera columna', () => {
    expect(detectHealthColumns(['', 'Pasos reales', 'Objetivo de pasos'])).toEqual({ date: 0, steps: 1, sleep: null });
    expect(detectHealthColumns(['Date', 'Goal', 'Steps'])).toEqual({ date: 0, steps: 2, sleep: null });
  });
  it('sueño: prefiere la duración sobre la puntuación y las horas de acostarse', () => {
    expect(detectHealthColumns(['Fecha', 'Puntuación del sueño', 'Hora de acostarse', 'Hora de despertarse', 'Duración', 'Necesidad de sueño'])).toEqual({ date: 0, steps: null, sleep: 4 });
    expect(detectHealthColumns(['Sleep Score 4 Weeks', 'Score', 'Resting Heart Rate', 'Quality', 'Duration', 'Sleep Need', 'Bedtime', 'Wake Time'])).toMatchObject({ steps: null, sleep: 4 });
  });
  it('un título suelto no es cabecera', () => {
    expect(detectHealthColumns(['Informe de sueño'])).toBeNull();
    expect(detectHealthColumns(['Fecha', 'Calorías'])).toBeNull();
  });
});

describe('parseHealthRows', () => {
  it('informe de sueño en español con título y filas vacías', () => {
    const csv = 'Informe de sueño\nFecha;Puntuación del sueño;Duración;Hora de acostarse\n2026-10-08;78;7h 32min;23:10\n2026-10-09;--;--;--\n2026-10-09;81;8h 5min;22:50\n';
    const r = parseHealthRows(parseCsv(csv).rows, TODAY);
    expect(r.rows).toEqual([{ kind: 'sleep', date: '2026-10-08', value: 7.53 }, { kind: 'sleep', date: '2026-10-09', value: 8.08 }]);
    expect(r).toMatchObject({ sleep: 2, steps: 0, skipped: 1, from: '2026-10-08', to: '2026-10-09', columns: { date: 'Fecha', sleep: 'Duración', steps: null } });
  });
  it('informe de pasos en inglés con fechas sin año', () => {
    const csv = ',Actual,Goal,Steps\nOct 8,x,8000,"10,512"\nOct 9,x,8000,"7,001"\nTotal,,,"17,513"\n';
    const r = parseHealthRows(parseCsv(csv).rows, TODAY);
    expect(r.rows).toEqual([{ kind: 'steps', date: '2026-10-08', value: 10512 }, { kind: 'steps', date: '2026-10-09', value: 7001 }]);
    expect(r.skipped).toBe(1);
  });
  it('archivo sin columnas de salud', () => {
    expect(parseHealthRows([['Fecha', 'Concepto', 'Importe'], ['01/10/2026', 'x', '1']], TODAY)).toMatchObject({ rows: [], columns: null });
  });
});
