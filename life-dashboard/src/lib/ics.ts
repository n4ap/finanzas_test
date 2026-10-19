/**
 * Lector de iCalendar (RFC 5545) para suscripciones de solo lectura. Cubre lo habitual en calendarios reales:
 * fechas UTC / con TZID / de día completo, DURATION, STATUS:CANCELLED, EXDATE, RECURRENCE-ID y RRULE sencillas
 * (DAILY/WEEKLY con BYDAY/MONTHLY/YEARLY con INTERVAL, COUNT y UNTIL). Lo que no entiende lo ignora sin romper el resto.
 */
export interface IcsEvent { key: string; title: string; description: string | null; location: string | null; startsAt: Date; endsAt: Date; allDay: boolean }
export interface IcsResult { events: IcsEvent[]; skipped: number }

const MAX_EVENTS = 5000;
const MAX_INSTANCES = 300;

// Nombres de zona de Windows (Outlook/Exchange) → IANA.
const WINDOWS_TZ: Record<string, string> = {
  'W. Europe Standard Time': 'Europe/Berlin', 'Romance Standard Time': 'Europe/Madrid', 'Central Europe Standard Time': 'Europe/Budapest', 'GMT Standard Time': 'Europe/London',
  'Eastern Standard Time': 'America/New_York', 'Central Standard Time': 'America/Chicago', 'Mountain Standard Time': 'America/Denver', 'Pacific Standard Time': 'America/Los_Angeles',
  'UTC': 'UTC', 'E. South America Standard Time': 'America/Sao_Paulo', 'India Standard Time': 'Asia/Kolkata', 'Tokyo Standard Time': 'Asia/Tokyo', 'AUS Eastern Standard Time': 'Australia/Sydney',
};

/** Desfase (ms) de la zona `tz` respecto a UTC en el instante `utc`. */
function offsetAt(utc: number, tz: string): number {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
  const p = Object.fromEntries(f.formatToParts(new Date(utc)).map((x) => [x.type, Number(x.value)])) as Record<string, number>;
  return Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!) - Math.floor(utc / 1000) * 1000;
}

/** Hora de reloj local (en `tz`) → instante UTC. Resuelve bien los cambios de hora salvo la hora inexistente (se mueve hacia delante). */
export function zonedToUtc(y: number, mo: number, d: number, h: number, mi: number, s: number, tz: string): Date {
  const naive = Date.UTC(y, mo - 1, d, h, mi, s);
  let guess = naive - offsetAt(naive, tz);
  guess = naive - offsetAt(guess, tz);
  return new Date(guess);
}

const validTz = (tz: string) => { try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; } };
const resolveTz = (tzid: string | undefined, fallback: string) => { if (!tzid) return fallback; const t = WINDOWS_TZ[tzid] ?? tzid; return validTz(t) ? t : fallback; };

interface Prop { name: string; params: Record<string, string>; value: string }
function parseLine(line: string): Prop | null {
  const i = line.indexOf(':');
  if (i < 0) return null;
  const head = line.slice(0, i).split(';');
  const params: Record<string, string> = {};
  for (const p of head.slice(1)) { const [k, ...v] = p.split('='); if (k) params[k.toUpperCase()] = v.join('=').replace(/^"|"$/g, ''); }
  return { name: head[0]!.toUpperCase(), params, value: line.slice(i + 1) };
}
const unescapeText = (s: string) => s.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');

interface Parsed { date: Date; allDay: boolean; parts: [number, number, number, number, number, number]; tz: string | null }
function parseDate(p: Prop, defaultTz: string): Parsed | null {
  const v = p.value.trim();
  let m = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (m) { const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]; return { date: zonedToUtc(y, mo, d, 0, 0, 0, defaultTz), allDay: true, parts: [y, mo, d, 0, 0, 0], tz: defaultTz }; }
  m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(v);
  if (!m) return null;
  const n = m.slice(1, 7).map(Number) as [number, number, number, number, number, number];
  if (m[7] === 'Z') return { date: new Date(Date.UTC(...([n[0], n[1] - 1, n[2], n[3], n[4], n[5]] as [number, number, number, number, number, number]))), allDay: false, parts: n, tz: null };
  const tz = resolveTz(p.params.TZID, defaultTz);
  return { date: zonedToUtc(n[0], n[1], n[2], n[3], n[4], n[5], tz), allDay: false, parts: n, tz };
}

function parseDuration(s: string): number | null {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(s.trim());
  if (!m) return null;
  const sec = (Number(m[2] ?? 0) * 7 * 86400) + Number(m[3] ?? 0) * 86400 + Number(m[4] ?? 0) * 3600 + Number(m[5] ?? 0) * 60 + Number(m[6] ?? 0);
  return (m[1] === '-' ? -1 : 1) * sec * 1000;
}

interface RawEvent { uid: string; props: Prop[] }
const first = (e: RawEvent, name: string) => e.props.find((p) => p.name === name);

const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
function expand(start: Parsed, tz: string, rule: Record<string, string>, window: { from: number; to: number }, duration: number, exdates: Set<number>): Date[] {
  const freq = rule.FREQ;
  const interval = Math.max(1, Number(rule.INTERVAL ?? 1));
  const count = rule.COUNT ? Number(rule.COUNT) : Infinity;
  let until = Infinity;
  if (rule.UNTIL) { const u = parseDate({ name: 'UNTIL', params: {}, value: rule.UNTIL.length === 8 ? rule.UNTIL : rule.UNTIL }, tz); if (u) until = u.date.getTime() + (u.allDay ? 86_400_000 : 0); }
  const [y, mo, d, h, mi, s] = start.parts;
  const useTz = start.tz;
  const at = (yy: number, mm: number, dd: number) => (useTz ? zonedToUtc(yy, mm, dd, h, mi, s, useTz) : new Date(Date.UTC(yy, mm - 1, dd, h, mi, s)));
  const out: Date[] = [];
  let produced = 0;
  const push = (dt: Date) => {
    if (produced >= count || dt.getTime() > until) return false;
    produced++;
    if (dt.getTime() + duration >= window.from && dt.getTime() <= window.to && !exdates.has(dt.getTime())) out.push(dt);
    return true;
  };
  const guard = 5000;
  if (freq === 'DAILY') {
    for (let i = 0; i < guard; i++) { const dt = at(y, mo, d + i * interval); if (dt.getTime() > window.to || dt.getTime() > until) break; if (!push(dt)) break; }
  } else if (freq === 'WEEKLY') {
    const byday = (rule.BYDAY ? rule.BYDAY.split(',').map((x) => DAYS.indexOf(x.slice(-2))).filter((x) => x >= 0) : [new Date(Date.UTC(y, mo - 1, d)).getUTCDay()]).sort((a, b) => a - b);
    const baseDow = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
    const weekStartDay = d - baseDow; // domingo de la semana inicial
    outer: for (let w = 0; w < guard; w++) {
      for (const dow of byday) {
        const dt = at(y, mo, weekStartDay + w * 7 * interval + dow);
        if (dt.getTime() < start.date.getTime()) continue;
        if (dt.getTime() > window.to || dt.getTime() > until) break outer;
        if (!push(dt)) break outer;
      }
    }
  } else if (freq === 'MONTHLY') {
    for (let i = 0; i < guard; i++) {
      const tmp = new Date(Date.UTC(y, mo - 1 + i * interval, 1));
      if (new Date(Date.UTC(tmp.getUTCFullYear(), tmp.getUTCMonth(), d)).getUTCMonth() !== tmp.getUTCMonth()) continue; // el día no existe ese mes
      const dt = at(tmp.getUTCFullYear(), tmp.getUTCMonth() + 1, d);
      if (dt.getTime() > window.to || dt.getTime() > until) break;
      if (!push(dt)) break;
    }
  } else if (freq === 'YEARLY') {
    for (let i = 0; i < 200; i++) {
      const yy = y + i * interval;
      if (new Date(Date.UTC(yy, mo - 1, d)).getUTCMonth() !== mo - 1) continue;
      const dt = at(yy, mo, d);
      if (dt.getTime() > window.to || dt.getTime() > until) break;
      if (!push(dt)) break;
    }
  } else push(start.date);
  return out.slice(0, MAX_INSTANCES);
}

export function parseIcs(text: string, opts: { defaultTz: string; now?: Date; pastDays?: number; futureDays?: number }): IcsResult {
  const now = opts.now ?? new Date();
  const window = { from: now.getTime() - (opts.pastDays ?? 30) * 86_400_000, to: now.getTime() + (opts.futureDays ?? 365) * 86_400_000 };
  const tz = validTz(opts.defaultTz) ? opts.defaultTz : 'UTC';
  const lines = text.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const raws: RawEvent[] = [];
  let cur: RawEvent | null = null;
  let depth = 0;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = { uid: '', props: [] }; depth = 0; continue; }
    if (!cur) continue;
    if (line === 'END:VEVENT') { raws.push(cur); cur = null; if (raws.length >= MAX_EVENTS) break; continue; }
    if (line.startsWith('BEGIN:')) { depth++; continue; }
    if (line.startsWith('END:')) { depth--; continue; }
    if (depth > 0) continue; // dentro de VALARM, etc.
    const p = parseLine(line);
    if (p) { cur.props.push(p); if (p.name === 'UID') cur.uid = p.value.trim(); }
  }

  const overrides = new Map<string, Set<number>>(); // uid → inicios sustituidos por RECURRENCE-ID
  for (const e of raws) {
    const rid = first(e, 'RECURRENCE-ID');
    if (!rid) continue;
    const d = parseDate(rid, tz);
    if (d) { const set = overrides.get(e.uid) ?? new Set<number>(); set.add(d.date.getTime()); overrides.set(e.uid, set); }
  }

  const events: IcsEvent[] = [];
  let skipped = 0;
  for (const e of raws) {
    if (first(e, 'STATUS')?.value.trim().toUpperCase() === 'CANCELLED') continue;
    const ds = first(e, 'DTSTART');
    const start = ds ? parseDate(ds, tz) : null;
    if (!start || !e.uid) { skipped++; continue; }
    const de = first(e, 'DTEND');
    const end = de ? parseDate(de, tz) : null;
    let duration: number;
    if (end) duration = end.date.getTime() - start.date.getTime();
    else { const du = first(e, 'DURATION'); duration = du ? (parseDuration(du.value) ?? 0) : start.allDay ? 86_400_000 : 0; }
    if (duration < 0) duration = 0;
    const title = unescapeText(first(e, 'SUMMARY')?.value ?? '').trim().slice(0, 200) || '(sin título)';
    const description = unescapeText(first(e, 'DESCRIPTION')?.value ?? '').trim().slice(0, 2000) || null;
    const location = unescapeText(first(e, 'LOCATION')?.value ?? '').trim().slice(0, 200) || null;
    const allDay = start.allDay;
    const finish = (s: Date): { startsAt: Date; endsAt: Date } => {
      if (allDay) return { startsAt: s, endsAt: new Date(s.getTime() + Math.max(duration, 86_400_000) - 60_000) }; // fin inclusivo (23:59), como los eventos manuales
      return { startsAt: s, endsAt: new Date(s.getTime() + duration) };
    };
    const rrule = first(e, 'RRULE');
    const isOverride = !!first(e, 'RECURRENCE-ID');
    if (rrule && !isOverride) {
      const rule = Object.fromEntries(rrule.value.split(';').map((kv) => { const [k, ...v] = kv.split('='); return [k!.toUpperCase(), v.join('=')]; })) as Record<string, string>;
      const ex = new Set<number>(overrides.get(e.uid) ?? []);
      for (const x of e.props.filter((p) => p.name === 'EXDATE')) for (const v of x.value.split(',')) { const d = parseDate({ ...x, value: v }, tz); if (d) ex.add(d.date.getTime()); }
      for (const dt of expand(start, tz, rule, window, duration, ex)) events.push({ key: `${e.uid}@${dt.toISOString()}`, title, description, location, allDay, ...finish(dt) });
    } else {
      const f = finish(start.date);
      if (f.endsAt.getTime() >= window.from && f.startsAt.getTime() <= window.to) events.push({ key: isOverride ? `${e.uid}@${start.date.toISOString()}` : `${e.uid}@${start.date.toISOString()}`, title, description, location, allDay, ...f });
    }
  }
  const seen = new Set<string>();
  return { events: events.filter((x) => (seen.has(x.key) ? false : (seen.add(x.key), true))).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()), skipped };
}
