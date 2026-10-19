import { describe, expect, it } from 'vitest';
import { categorize, csvText, dedupeKey, detectMapping, mapRows, markDuplicates, parseAmount, parseCsv, parseDate, sumMoney } from './finance';

describe('parseAmount', () => {
  it.each([
    ['1.234,56', 1234.56], ['-1.234,56', -1234.56], ['1,234.56', 1234.56], ['-45,3', -45.3], ['45.30', 45.3],
    ['1.234', 1234], ['1.234.567', 1234567], ['(45,00)', -45], ['45,00-', -45], ['12 €', 12], ['+3,5', 3.5], ['1,234,567', 1234567], ['0,1', 0.1],
  ])('%s → %s', (raw, expected) => expect(parseAmount(raw)).toBe(expected));
  it.each(['', 'abc', '12abc', '--', '1.2.3,4,5x'])('rechaza «%s»', (raw) => expect(parseAmount(raw)).toBeNull());
});

describe('parseDate', () => {
  it.each([['04/10/2026', '2026-10-04'], ['4-10-26', '2026-10-04'], ['04.10.2026', '2026-10-04'], ['2026-10-04', '2026-10-04'], ['2026-1-5', '2026-01-05']])('%s', (raw, e) => expect(parseDate(raw)).toBe(e));
  it('rechaza fechas imposibles', () => {
    expect(parseDate('31/02/2026')).toBeNull();
    expect(parseDate('32/01/2026')).toBeNull();
    expect(parseDate('hola')).toBeNull();
    expect(parseDate('29/02/2028')).toBe('2028-02-29');
  });
});

describe('parseCsv', () => {
  it('detecta ; y respeta comillas, comas internas y comillas escapadas', () => {
    const r = parseCsv('Fecha;Concepto;Importe\n04/10/2026;"Cena, con ""amigos""";-45,30\n');
    expect(r.delimiter).toBe(';');
    expect(r.rows).toEqual([['Fecha', 'Concepto', 'Importe'], ['04/10/2026', 'Cena, con "amigos"', '-45,30']]);
  });
  it('soporta saltos de línea dentro de comillas, CRLF, BOM y líneas vacías', () => {
    const r = parseCsv('﻿a,b\r\n"x\ny",2\r\n\r\n3,4');
    expect(r.rows).toEqual([['a', 'b'], ['x\ny', '2'], ['3', '4']]);
  });
  it('detecta tabuladores y no se confunde con comas dentro de comillas', () => {
    expect(parseCsv('a\tb\n"1,5"\t2').rows[1]).toEqual(['1,5', '2']);
  });
});

describe('detectMapping y mapRows', () => {
  it('mapea cabeceras habituales con importe único', () => {
    expect(detectMapping(['Fecha', 'Concepto', 'Importe', 'Saldo'])).toEqual({ date: 0, description: 1, amount: 2, debit: null, credit: null });
  });
  it('mapea cargo/abono por separado y tolera acentos y mayúsculas', () => {
    expect(detectMapping(['Fecha operación', 'Descripción', 'Cargo', 'Abono'])).toMatchObject({ date: 0, description: 1, debit: 2, credit: 3, amount: null });
  });
  it('devuelve null si faltan columnas imprescindibles', () => {
    expect(detectMapping(['Foo', 'Bar'])).toBeNull();
  });
  it('convierte filas, categoriza y reporta errores con su línea', () => {
    const m = detectMapping(['Fecha', 'Concepto', 'Importe'])!;
    const rows = mapRows([['04/10/2026', 'MERCADONA 123', '-32,10'], ['05/10/2026', 'Nómina octubre', '2.650,00'], ['32/13/2026', 'x', '1'], ['06/10/2026', '', '5'], ['07/10/2026', 'y', 'abc'], ['08/10/2026', 'z', '0']], m);
    expect(rows[0]).toMatchObject({ line: 2, date: '2026-10-04', amount: -32.1, category: 'alimentacion' });
    expect(rows[1]).toMatchObject({ amount: 2650, category: 'ingresos' });
    expect(rows.slice(2).map((r) => r.error)).toEqual(['Fecha no válida', 'Falta el concepto', 'Importe no válido', 'Importe cero']);
  });
  it('combina cargo y abono en un importe con signo', () => {
    const m = detectMapping(['Fecha', 'Concepto', 'Cargo', 'Abono'])!;
    const rows = mapRows([['01/10/2026', 'Luz', '45,00', ''], ['02/10/2026', 'Nómina', '', '2000,00'], ['03/10/2026', 'Devolución', '-10,00', '']], m);
    expect(rows.map((r) => r.amount)).toEqual([-45, 2000, -10]);
  });
});

describe('categorize', () => {
  it.each([
    ['Netflix.com', -15.99, 'suscripciones'], ['COMPRA MERCADONA', -40, 'alimentacion'], ['Repsol estación', -50, 'transporte'], ['Iberdrola luz', -60, 'vivienda'],
    ['AMAZON EU', -30, 'compras'], ['Vuelo Ryanair', -120, 'viajes'], ['Cine Yelmo', -9, 'ocio'], ['Algo raro', -5, 'otros'], ['Nómina', 100, 'ingresos'],
  ])('%s → %s', (d, a, c) => expect(categorize(d, a)).toBe(c));
  it('no confunde «media» o «días» con el supermercado DIA', () => {
    expect(categorize('Pago medias deportivas', -10)).not.toBe('alimentacion');
    expect(categorize('Dia supermercado', -10)).toBe('alimentacion');
  });
});

describe('markDuplicates', () => {
  const m = detectMapping(['Fecha', 'Concepto', 'Importe'])!;
  const rows = mapRows([['04/10/2026', 'Café', '-2,50'], ['04/10/2026', 'Café', '-2,50'], ['05/10/2026', 'Libro', '-12,00']], m);
  it('multiconjunto: 1 existente cubre solo una de dos filas idénticas', () => {
    const out = markDuplicates(rows, [dedupeKey('2026-10-04', -2.5, 'CAFÉ')]);
    expect(out.map((r) => !!r.duplicate)).toEqual([true, false, false]);
  });
  it('reimportar el mismo archivo marca todo como duplicado', () => {
    const existing = rows.map((r) => dedupeKey(r.date!, r.amount!, r.description));
    expect(markDuplicates(rows, existing).every((r) => r.duplicate)).toBe(true);
  });
});

describe('dinero y CSV seguro', () => {
  it('suma sin errores de coma flotante', () => {
    expect(sumMoney([0.1, 0.2])).toBe(0.3);
    expect(0.1 + 0.2).not.toBe(0.3);
  });
  it('neutraliza inyección de fórmulas y escapa campos', () => {
    expect(csvText('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvText('+34 600')).toBe("'+34 600");
    expect(csvText('hola, mundo')).toBe('"hola, mundo"');
    expect(csvText('normal')).toBe('normal');
  });
});
