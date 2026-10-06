export const EXPENSE_IDS = ['vivienda', 'alimentacion', 'transporte', 'ocio', 'compras', 'viajes', 'suscripciones', 'otros'] as const;
export type ExpenseCategory = (typeof EXPENSE_IDS)[number];
const EXPENSE_LABELS: Record<ExpenseCategory, string> = {
  vivienda: 'Vivienda', alimentacion: 'Alimentación', transporte: 'Transporte', ocio: 'Ocio', compras: 'Compras', viajes: 'Viajes', suscripciones: 'Suscripciones', otros: 'Otros',
};
export const EXPENSE_CATEGORIES = EXPENSE_IDS.map((id) => ({ id, label: EXPENSE_LABELS[id] }));
export const INCOME_CATEGORY = 'ingresos' as const;
export const ALL_CATEGORIES = [...EXPENSE_IDS, INCOME_CATEGORY] as const;
export const categoryLabel = (id: string) => (id === INCOME_CATEGORY ? 'Ingresos' : EXPENSE_LABELS[id as ExpenseCategory] ?? id);

export const ACCOUNT_KINDS = [
  { id: 'checking', label: 'Cuenta corriente' }, { id: 'savings', label: 'Ahorro' }, { id: 'cash', label: 'Efectivo' }, { id: 'credit', label: 'Tarjeta de crédito' },
] as const;
export const ASSET_TYPES = [
  { id: 'stock', label: 'Acciones' }, { id: 'etf', label: 'ETFs' }, { id: 'fund', label: 'Fondos' }, { id: 'crypto', label: 'Cripto' },
] as const;
export const assetLabel = (id: string) => ASSET_TYPES.find((a) => a.id === id)?.label ?? id;

// ───────────── Dinero: se opera en céntimos enteros para evitar errores de coma flotante ─────────────
export const toCents = (n: number) => Math.round(n * 100);
export const fromCents = (c: number) => c / 100;
export const round2 = (n: number) => fromCents(toCents(n));
export const sumMoney = (values: number[]) => fromCents(values.reduce((a, v) => a + toCents(v), 0));

// ───────────── Normalización de texto ─────────────
export const normalizeText = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim();

// ───────────── Categorización automática por palabras clave ─────────────
const RULES: [ExpenseCategory, RegExp][] = [
  ['suscripciones', /\b(netflix|spotify|hbo|disney|prime video|youtube premium|icloud|apple\.com\/bill|gimnasio|gym|dazn|audible|patreon|suscripcion)\b/],
  ['viajes', /\b(vuelo|iberia|ryanair|vueling|booking|airbnb|hotel|hostal|easyjet|expedia|aerolinea|alojamiento)\b/],
  ['transporte', /\b(gasolina|gasolinera|repsol|cepsa|galp|shell|metro|renfe|taxi|uber|cabify|parking|peaje|bus|emt|blablacar|itv|combustible)\b/],
  ['vivienda', /\b(alquiler|hipoteca|comunidad|endesa|iberdrola|naturgy|luz|gas natural|agua|canal de isabel|internet|fibra|ibi|seguro hogar)\b/],
  ['alimentacion', /\b(mercadona|carrefour|lidl|dia|aldi|supermercado|alcampo|eroski|fruteria|panaderia|consum|carniceria|pescaderia|hipercor)\b/],
  ['compras', /\b(amazon|zara|decathlon|ikea|el corte ingles|mediamarkt|pccomponentes|aliexpress|leroy merlin|primark|h&m|fnac)\b/],
  ['ocio', /\b(cine|restaurante|bar|cerveceria|cervezas?|concierto|teatro|steam|pub|discoteca|ticketmaster|ticketera|cafeteria|cafe)\b/],
];

/** Positivo → ingresos. Negativo → primera regla que encaje, o «otros». */
export function categorize(description: string, amount: number): string {
  if (amount > 0) return INCOME_CATEGORY;
  const t = normalizeText(description);
  for (const [cat, re] of RULES) if (re.test(t)) return cat;
  return 'otros';
}

// ───────────── Parseo de CSV ─────────────
export interface ParsedCsv { delimiter: string; rows: string[][] }

/** Parser CSV (RFC 4180): comillas, comillas escapadas (""), saltos de línea dentro de campos, BOM. Detecta ; , tab en las primeras líneas. */
export function parseCsv(text: string): ParsedCsv {
  const src = text.replace(/^﻿/, '');
  // Se mira en las primeras líneas (no solo la primera): los extractos de banco empiezan con un título sin separadores.
  const head = src.split(/\r?\n/, 30).filter((l) => l.trim() !== '');
  const count = (d: string) => { let n = 0; for (const line of head) { let q = false; for (const ch of line) { if (ch === '"') q = !q; else if (!q && ch === d) n++; } } return n; };
  const counts = ([';', '\t', ','] as const).map((d) => [d, count(d)] as const).sort((x, y) => y[1] - x[1]);
  const delimiter = counts[0]![1] > 0 ? counts[0]![0] : ',';

  const rows: string[][] = [];
  let row: string[] = [], field = '', inQuotes = false, i = 0;
  const endField = () => { row.push(field); field = ''; };
  const endRow = () => { endField(); if (row.some((c) => c.trim() !== '')) rows.push(row); row = []; };
  while (i < src.length) {
    const ch = src[i]!;
    if (inQuotes) {
      if (ch === '"') { if (src[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; } else field += ch;
    } else if (ch === '"' && field === '') inQuotes = true;
    else if (ch === delimiter) endField();
    else if (ch === '\n') endRow();
    else if (ch === '\r') { if (src[i + 1] === '\n') i++; endRow(); }
    else field += ch;
    i++;
  }
  if (field !== '' || row.length) endRow();
  return { delimiter, rows };
}

/** Número en formato español o inglés: «1.234,56», «1,234.56», «-45,3», «(45,00)», «12 €». null si no es un número. */
export function parseAmount(raw: string): number | null {
  let s = raw.trim().replace(/[€$£\s ]/g, '').replace(/^\+/, '');
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
  if (s.endsWith('-')) { negative = !negative; s = s.slice(0, -1); }
  if (s.startsWith('-')) { negative = !negative; s = s.slice(1); }
  if (!/^[\d.,]+$/.test(s)) return null;
  const lastDot = s.lastIndexOf('.'), lastComma = s.lastIndexOf(',');
  let normalized: string;
  if (lastDot >= 0 && lastComma >= 0) {
    const dec = lastDot > lastComma ? '.' : ',';
    normalized = dec === '.' ? s.replace(/,/g, '') : s.replace(/\./g, '').replace(',', '.');
  } else if (lastComma >= 0) {
    // «1,234,567» (varias comas) son miles; una sola coma es decimal.
    normalized = (s.match(/,/g)?.length ?? 0) > 1 ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if (lastDot >= 0) {
    // «1.234» o «1.234.567» son miles en español; «45.30» es decimal.
    normalized = /^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, '') : s;
  } else normalized = s;
  const n = Number(normalized);
  return Number.isFinite(n) ? round2(negative ? -n : n) : null;
}

/** Fecha dd/mm/aaaa, dd-mm-aa, dd.mm.aaaa o aaaa-mm-dd → 'AAAA-MM-DD'. null si no es una fecha real. */
export function parseDate(raw: string): string | null {
  const s = raw.trim().slice(0, 10);
  let y: number, m: number, d: number;
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const es = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (iso) { y = +iso[1]!; m = +iso[2]!; d = +iso[3]!; }
  else if (es) { d = +es[1]!; m = +es[2]!; y = +es[3]!; if (y < 100) y += 2000; }
  else return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// ───────────── Mapeo de columnas ─────────────
export interface ColumnMapping { date: number; description: number; amount: number | null; debit: number | null; credit: number | null }

const HEADER_ALIASES: Record<keyof ColumnMapping, string[]> = {
  date: ['fecha', 'fecha operacion', 'fecha valor', 'f operacion', 'f valor', 'date', 'booking date', 'fecha contable'],
  description: ['concepto', 'descripcion', 'description', 'detalle', 'movimiento', 'observaciones', 'concepto movimiento', 'details', 'descripcion operacion', 'concepto operacion', 'comercio'],
  amount: ['importe', 'amount', 'cantidad', 'monto', 'importe eur', 'importe (eur)', 'importe ()', 'importe euros'],
  debit: ['cargo', 'cargos', 'debe', 'debit', 'gasto', 'gastos'],
  credit: ['abono', 'abonos', 'haber', 'credit', 'ingreso', 'ingresos'],
};

/** Propone el mapeo de columnas a partir de la cabecera. null si no puede identificar lo imprescindible. */
export function detectMapping(header: string[]): ColumnMapping | null {
  const norm = header.map((h) => normalizeText(h).replace(/[^a-z0-9 ()]/g, '').trim());
  const find = (key: keyof ColumnMapping) => { const i = norm.findIndex((h) => HEADER_ALIASES[key].includes(h)); return i >= 0 ? i : null; };
  const date = find('date'), description = find('description'), amount = find('amount'), debit = find('debit'), credit = find('credit');
  if (date === null || description === null || (amount === null && debit === null && credit === null)) return null;
  return { date, description, amount, debit, credit };
}

/**
 * Busca la fila de cabecera en las primeras filas: los extractos de banco (p. ej. Bankinter en Excel) traen antes
 * el titular, la cuenta y el periodo. Devuelve el índice de la primera fila con columnas reconocibles, o 0.
 */
export function findHeaderRow(rows: string[][], maxScan = 30): number {
  const i = rows.slice(0, maxScan).findIndex((r) => detectMapping(r) !== null);
  return i >= 0 ? i : 0;
}

export interface ImportRow { line: number; date: string | null; description: string; amount: number | null; category: string; error?: string; duplicate?: boolean }

/** Convierte filas de datos en filas de importación validadas y categorizadas. `line` es la línea 1-based del archivo. */
export function mapRows(rows: string[][], mapping: ColumnMapping, firstDataLine = 2): ImportRow[] {
  return rows.map((r, idx) => {
    const line = idx + firstDataLine;
    const date = parseDate(r[mapping.date] ?? '');
    const description = (r[mapping.description] ?? '').trim().replace(/\s+/g, ' ').slice(0, 200);
    let amount: number | null = null;
    if (mapping.amount !== null) amount = parseAmount(r[mapping.amount] ?? '');
    else {
      const debit = mapping.debit !== null ? parseAmount(r[mapping.debit] ?? '') : null;
      const credit = mapping.credit !== null ? parseAmount(r[mapping.credit] ?? '') : null;
      if (debit !== null || credit !== null) amount = round2((credit ?? 0) - Math.abs(debit ?? 0));
    }
    const error = !date ? 'Fecha no válida' : !description ? 'Falta el concepto' : amount === null ? 'Importe no válido' : amount === 0 ? 'Importe cero' : undefined;
    return { line, date, description, amount, category: amount !== null ? categorize(description, amount) : 'otros', error };
  });
}

export const dedupeKey = (date: string, amount: number, description: string) => `${date}|${toCents(amount)}|${normalizeText(description)}`;

/** Marca como duplicadas las filas que ya existen. Multiconjunto: 2 filas iguales en el archivo y 1 en BD → solo 1 duplicada. */
export function markDuplicates(rows: ImportRow[], existingKeys: string[]): ImportRow[] {
  const pool = new Map<string, number>();
  for (const k of existingKeys) pool.set(k, (pool.get(k) ?? 0) + 1);
  return rows.map((r) => {
    if (r.error || !r.date || r.amount === null) return r;
    const k = dedupeKey(r.date, r.amount, r.description);
    const left = pool.get(k) ?? 0;
    if (left > 0) { pool.set(k, left - 1); return { ...r, duplicate: true }; }
    return r;
  });
}

// ───────────── Exportación CSV segura ─────────────
/** Escapa un campo de texto y neutraliza inyección de fórmulas (=, +, -, @) al abrir en Excel/Sheets. */
export function csvText(value: string): string {
  const v = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",;\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
