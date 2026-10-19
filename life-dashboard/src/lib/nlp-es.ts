import { addDaysKey, localKey, weekdayOf } from './tz';

/** Plegado de acentos 1:1 (mantiene los índices para poder recortar el texto original). */
const fold = (s: string) => s.toLowerCase().replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e').replace(/[íìï]/g, 'i').replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u').replace(/ñ/g, 'n');

const WEEKDAYS: Record<string, number> = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export interface When { dateKey?: string; time?: string; rest: string }

const pad = (n: number) => String(n).padStart(2, '0');
const validDay = (y: number, m: number, d: number) => { const t = new Date(Date.UTC(y, m - 1, d, 12)); return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d; };

/**
 * Extrae fecha y hora de una frase en español («mañana a las 10», «el viernes», «15/11», «en 3 días»…)
 * y devuelve además el texto sobrante (para usarlo como título). Solo reglas deterministas: lo que no reconoce, lo deja en `rest`.
 */
export function parseWhen(text: string, now: Date, offset: number): When {
  let s = text;
  let f = fold(text);
  const today = localKey(now, offset);
  let dateKey: string | undefined;
  let time: string | undefined;
  const cut = (m: RegExpExecArray) => { s = s.slice(0, m.index) + ' '.repeat(m[0].length) + s.slice(m.index + m[0].length); f = f.slice(0, m.index) + ' '.repeat(m[0].length) + f.slice(m.index + m[0].length); };
  const take = (re: RegExp) => { const m = re.exec(f); if (m) cut(m); return m; };

  // Franjas del día (antes que «mañana» para no confundir «por la mañana»).
  let defaultTime: string | undefined;
  if (take(/\b(?:por la|de la|esta) manana\b/)) defaultTime = '09:00';
  if (take(/\b(?:por la|esta) tarde\b/)) defaultTime = '17:00';
  if (take(/\b(?:por la|esta) noche\b/)) defaultTime = '21:00';
  const pm = /\bde la (?:tarde|noche)\b/.test(f);

  // Hora
  let m = take(/\b(?:a las|a la)\s+(\d{1,2})(?::(\d{2})|\s*h(?:oras)?\b)?(?:\s+de la (?:tarde|noche))?/) ?? take(/\b(\d{1,2}):(\d{2})\b/);
  if (m) {
    let h = Number(m[1]);
    const min = Number(m[2] ?? 0);
    if (pm && h < 12) h += 12;
    if (h <= 23 && min <= 59) time = `${pad(h)}:${pad(min)}`;
  }
  time ??= defaultTime;

  // Fecha
  if (take(/\bpasado manana\b/)) dateKey = addDaysKey(today, 2);
  else if (take(/\bmanana\b/)) dateKey = addDaysKey(today, 1);
  else if (take(/\bhoy\b/) || defaultTime) dateKey = today;
  if (!dateKey && (m = take(/\ben (\d{1,3}) (dias?|semanas?)\b/))) dateKey = addDaysKey(today, Number(m[1]) * (m[2]!.startsWith('semana') ? 7 : 1));
  if (!dateKey && (m = take(/\b(?:el |este |proximo |el proximo )?(domingo|lunes|martes|miercoles|jueves|viernes|sabado)\b/))) {
    const target = WEEKDAYS[m[1]!]!;
    const delta = ((target - weekdayOf(today) + 6) % 7) + 1; // siguiente ocurrencia estrictamente posterior a hoy
    dateKey = addDaysKey(today, delta);
  }
  if (!dateKey && (m = take(/\b(?:el )?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/))) {
    const y0 = Number(today.slice(0, 4));
    let y = m[3] ? Number(m[3]) + (m[3].length === 2 ? 2000 : 0) : y0;
    if (validDay(y, Number(m[2]), Number(m[1]))) {
      let key = `${y}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`;
      if (!m[3] && key < today) { y += 1; if (validDay(y, Number(m[2]), Number(m[1]))) key = `${y}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`; }
      dateKey = key;
    }
  }
  if (!dateKey && (m = take(new RegExp(`\\b(?:el )?(\\d{1,2}) de (${MONTHS.join('|')})(?: de (\\d{4}))?\\b`)))) {
    const mo = MONTHS.indexOf(m[2]!) + 1;
    let y = m[3] ? Number(m[3]) : Number(today.slice(0, 4));
    if (validDay(y, mo, Number(m[1]))) {
      let key = `${y}-${pad(mo)}-${pad(Number(m[1]))}`;
      if (!m[3] && key < today) { y += 1; key = `${y}-${pad(mo)}-${pad(Number(m[1]))}`; }
      if (validDay(y, mo, Number(m[1]))) dateKey = key;
    }
  }
  const rest = s.replace(/\b(?:para|el|la|a|de|en)\s*(?=$|[,.])/gi, ' ').replace(/\s+/g, ' ').replace(/^[\s,.:;-]+|[\s,.:;-]+$/g, '').replace(/\s+(?:para|el|a|de|en)$/i, '').trim();
  return { dateKey, time, rest };
}
