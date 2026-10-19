/**
 * Importación de pasos y sueño desde los archivos que exporta Garmin Connect (Informes → Pasos / Sueño → Exportar),
 * en CSV o Excel. Es tolerante: busca la fila de cabecera, la columna de fecha y la de pasos y/o duración del sueño,
 * y entiende fechas «2026-10-03», «03/10/2026», «3 oct 2026», «Oct 3, 2026» y duraciones «7h 32min», «7:32» o «7,5».
 */
import { normalizeText, parseDate } from './finance';
import { METRIC_META } from './health';

export interface HealthImportRow { kind: 'steps' | 'sleep'; date: string; value: number }
export interface HealthImportResult { rows: HealthImportRow[]; steps: number; sleep: number; skipped: number; from: string | null; to: string | null; columns: { date: string; steps: string | null; sleep: string | null } | null }

const norm = (s: string) => normalizeText(s).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const DATE_HEADERS = ['fecha', 'date', 'dia', 'day', 'fecha del calendario', 'calendar date', 'noche', 'night', 'semana', 'week'];
const isStepsHeader = (h: string) => /\b(pasos|steps)\b/.test(h) && !/(objetivo|goal|meta|distancia|distance|pisos|floors)/.test(h);
const isSleepHeader = (h: string) => (/\b(duracion|duration)\b/.test(h) || /\b(sueno|sleep)\b/.test(h) || /\bhoras\b/.test(h))
  && !/(puntuacion|score|necesidad|need|hora de|bedtime|wake|despert|acost|calidad|quality|frecuencia|heart|body battery|respir|spo2|estres|stress|objetivo|goal|fase|stage|profundo|deep|ligero|light|rem|despierto|awake|interrup)/.test(h);

/** Columnas de la cabecera: la de fecha (o la primera, sin título, como en los informes de Garmin), pasos y sueño. */
export function detectHealthColumns(header: string[]): { date: number; steps: number | null; sleep: number | null } | null {
  if (header.filter((c) => c.trim() !== '').length < 2) return null; // un título suelto («Informe de sueño») no es la cabecera
  const h = header.map(norm);
  const steps = h.findIndex(isStepsHeader);
  // En sueño, la «duración» manda sobre otros títulos con «sueño».
  let sleep = h.findIndex((x) => isSleepHeader(x) && /\b(duracion|duration)\b/.test(x));
  if (sleep < 0) sleep = h.findIndex(isSleepHeader);
  if (steps < 0 && sleep < 0) return null;
  let date = h.findIndex((x) => DATE_HEADERS.includes(x) || /^(fecha|date)\b/.test(x));
  if (date < 0) date = h.findIndex((x, i) => x === '' && i !== steps && i !== sleep);
  if (date < 0) date = [0, 1, 2].find((i) => i !== steps && i !== sleep) ?? 0;
  return { date, steps: steps >= 0 ? steps : null, sleep: sleep >= 0 ? sleep : null };
}

const MONTHS: Record<string, number> = {
  ene: 1, jan: 1, feb: 2, mar: 3, abr: 4, apr: 4, may: 5, jun: 6, jul: 7, ago: 8, aug: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12, dec: 12,
};
const pad = (n: number) => String(n).padStart(2, '0');

/** Fecha de un informe de Garmin → 'AAAA-MM-DD'. Sin año, el más reciente que no quede en el futuro. */
export function parseHealthDate(raw: string, today = new Date()): string | null {
  const direct = parseDate(raw);
  if (direct) return direct;
  const s = norm(raw).replace(/\b(de|del)\b/g, ' ').replace(/\s+/g, ' ');
  const word = (w: string) => MONTHS[w.slice(0, 3)];
  let d: number | undefined, m: number | undefined, y: number | undefined;
  let r = s.match(/^(?:[a-z]+ )?(\d{1,2}) ([a-z]+)(?: (\d{4}))?$/); // «3 oct 2026», «vie 3 oct»
  if (r && word(r[2]!)) { d = +r[1]!; m = word(r[2]!); y = r[3] ? +r[3] : undefined; }
  r = s.match(/^(?:[a-z]+ )?([a-z]+) (\d{1,2})(?: (\d{4}))?$/); // «Oct 3 2026», «Fri Oct 3»
  if (!m && r && word(r[1]!)) { m = word(r[1]!); d = +r[2]!; y = r[3] ? +r[3] : undefined; }
  if (!m || !d) return null;
  if (y === undefined) {
    y = today.getFullYear();
    if (new Date(y, m - 1, d) > today) y -= 1;
  }
  return parseDate(`${pad(d)}/${pad(m)}/${y}`);
}

/** Duración del sueño en horas: «7h 32min», «7 h 32 min», «7:32», «7,5», «452» (minutos). null si no es válida. */
export function parseSleepHours(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!s || /^[-–—]+$/.test(s)) return null;
  let hours: number | null = null;
  const hm = s.match(/^(\d{1,2}) ?h(?:oras?|rs?)?(?: ?(\d{1,2}) ?m(?:in(?:utos?|s)?)?)?$/);
  const mOnly = s.match(/^(\d{1,4}) ?m(?:in(?:utos?|s)?)?$/);
  const clock = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (hm) hours = +hm[1]! + (hm[2] ? +hm[2] / 60 : 0);
  else if (mOnly) hours = +mOnly[1]! / 60;
  else if (clock) hours = +clock[1]! + +clock[2]! / 60;
  else if (/^\d+([.,]\d+)?$/.test(s)) {
    const n = Number(s.replace(',', '.'));
    hours = n > 24 && n <= 1440 ? n / 60 : n;
  }
  if (hours === null || !Number.isFinite(hours) || hours <= 0 || hours > METRIC_META.sleep.max) return null;
  return Math.round(hours * 100) / 100;
}

/** Pasos: solo dígitos (los separadores de miles pueden ser «.» o «,»). */
export function parseSteps(raw: string): number | null {
  const s = raw.trim();
  if (!/^\d{1,3}([.,\s ]?\d{3})*$/.test(s)) return null;
  const n = Number(s.replace(/[.,\s ]/g, ''));
  return n > 0 && n <= METRIC_META.steps.max ? n : null;
}

/** Filas del archivo → mediciones de pasos y sueño (un valor por tipo y día; si se repite, el último). */
export function parseHealthRows(rows: string[][], today = new Date()): HealthImportResult {
  const empty: HealthImportResult = { rows: [], steps: 0, sleep: 0, skipped: 0, from: null, to: null, columns: null };
  const at = rows.slice(0, 30).findIndex((r) => detectHealthColumns(r) !== null);
  if (at < 0) return empty;
  const header = rows[at]!;
  const cols = detectHealthColumns(header)!;
  const byKey = new Map<string, HealthImportRow>();
  let skipped = 0;
  for (const r of rows.slice(at + 1)) {
    const date = parseHealthDate(r[cols.date] ?? '', today);
    const steps = cols.steps !== null ? parseSteps(r[cols.steps] ?? '') : null;
    const sleep = cols.sleep !== null ? parseSleepHours(r[cols.sleep] ?? '') : null;
    if (!date || (steps === null && sleep === null)) { skipped++; continue; }
    if (steps !== null) byKey.set(`steps|${date}`, { kind: 'steps', date, value: steps });
    if (sleep !== null) byKey.set(`sleep|${date}`, { kind: 'sleep', date, value: sleep });
  }
  const out = [...byKey.values()].sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind));
  return {
    rows: out,
    steps: out.filter((r) => r.kind === 'steps').length,
    sleep: out.filter((r) => r.kind === 'sleep').length,
    skipped,
    from: out[0]?.date ?? null,
    to: out.at(-1)?.date ?? null,
    columns: { date: header[cols.date] || 'Columna 1', steps: cols.steps !== null ? header[cols.steps]! : null, sleep: cols.sleep !== null ? header[cols.sleep]! : null },
  };
}
