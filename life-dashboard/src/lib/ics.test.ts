import { describe, expect, it } from 'vitest';
import { parseIcs, zonedToUtc } from './ics';

const NOW = new Date('2026-10-05T06:00:00Z');
const wrap = (...events: string[]) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${events.join('\r\n')}\r\nEND:VCALENDAR\r\n`;
const ev = (...lines: string[]) => `BEGIN:VEVENT\r\n${lines.join('\r\n')}\r\nEND:VEVENT`;
const parse = (s: string, tz = 'Europe/Madrid') => parseIcs(s, { defaultTz: tz, now: NOW });

describe('zonedToUtc', () => {
  it('verano e invierno en Madrid', () => {
    expect(zonedToUtc(2026, 7, 1, 10, 0, 0, 'Europe/Madrid').toISOString()).toBe('2026-07-01T08:00:00.000Z');
    expect(zonedToUtc(2026, 12, 1, 10, 0, 0, 'Europe/Madrid').toISOString()).toBe('2026-12-01T09:00:00.000Z');
    expect(zonedToUtc(2026, 10, 25, 10, 0, 0, 'Europe/Madrid').toISOString()).toBe('2026-10-25T09:00:00.000Z'); // ya en horario de invierno
    expect(zonedToUtc(2026, 10, 6, 9, 30, 0, 'America/New_York').toISOString()).toBe('2026-10-06T13:30:00.000Z');
  });
});

describe('parseIcs: fechas', () => {
  it('UTC, TZID y flotante (zona del usuario)', () => {
    const r = parse(wrap(
      ev('UID:a', 'SUMMARY:UTC', 'DTSTART:20261006T080000Z', 'DTEND:20261006T090000Z'),
      ev('UID:b', 'SUMMARY:NY', 'DTSTART;TZID=America/New_York:20261006T093000', 'DTEND;TZID=America/New_York:20261006T103000'),
      ev('UID:c', 'SUMMARY:Flotante', 'DTSTART:20261006T100000', 'DTEND:20261006T110000'),
      ev('UID:d', 'SUMMARY:Windows', 'DTSTART;TZID=Romance Standard Time:20261006T120000', 'DURATION:PT90M'),
    ));
    const by = Object.fromEntries(r.events.map((e) => [e.title, e]));
    expect(by.UTC!.startsAt.toISOString()).toBe('2026-10-06T08:00:00.000Z');
    expect(by.NY!.startsAt.toISOString()).toBe('2026-10-06T13:30:00.000Z');
    expect(by.Flotante!.startsAt.toISOString()).toBe('2026-10-06T08:00:00.000Z');
    expect(by.Windows!.startsAt.toISOString()).toBe('2026-10-06T10:00:00.000Z');
    expect(by.Windows!.endsAt.toISOString()).toBe('2026-10-06T11:30:00.000Z');
  });
  it('día completo: DTEND exclusivo → fin inclusivo 23:59 local', () => {
    const [e] = parse(wrap(ev('UID:x', 'SUMMARY:Vacaciones', 'DTSTART;VALUE=DATE:20261012', 'DTEND;VALUE=DATE:20261015'))).events;
    expect(e).toMatchObject({ allDay: true });
    expect(e!.startsAt.toISOString()).toBe('2026-10-11T22:00:00.000Z');
    expect(e!.endsAt.toISOString()).toBe('2026-10-14T21:59:00.000Z');
  });
});

describe('parseIcs: texto y robustez', () => {
  it('desdobla líneas, desescapa y recorta; ignora VALARM y cancelados y sin UID', () => {
    const r = parse(wrap(
      ev('UID:t', 'SUMMARY:Reunión\\, con\\nsalto', 'DESCRIPTION:Línea larga que continúa ', ' aquí mismo', 'LOCATION:Sala 3\; planta 2', 'DTSTART:20261006T080000Z', 'DTEND:20261006T090000Z', 'BEGIN:VALARM', 'ACTION:DISPLAY', 'SUMMARY:alarma', 'END:VALARM'),
      ev('UID:c', 'SUMMARY:Cancelado', 'STATUS:CANCELLED', 'DTSTART:20261006T080000Z'),
      ev('SUMMARY:SinUid', 'DTSTART:20261006T080000Z'),
      ev('UID:bad', 'SUMMARY:FechaRota', 'DTSTART:mañana'),
    ));
    expect(r.events).toHaveLength(1);
    expect(r.events[0]).toMatchObject({ title: 'Reunión, con\nsalto', description: 'Línea larga que continúa aquí mismo', location: 'Sala 3; planta 2' });
    expect(r.skipped).toBe(2);
  });
  it('descarta lo que queda fuera de la ventana y tolera basura', () => {
    const r = parse(wrap(ev('UID:old', 'SUMMARY:Viejo', 'DTSTART:20200101T080000Z', 'DTEND:20200101T090000Z'), ev('UID:far', 'SUMMARY:Lejano', 'DTSTART:20300101T080000Z')));
    expect(r.events).toEqual([]);
    expect(parse('esto no es un calendario').events).toEqual([]);
    expect(parse('').events).toEqual([]);
  });
});

describe('parseIcs: recurrencias', () => {
  it('semanal con BYDAY, COUNT y EXDATE', () => {
    const r = parse(wrap(ev('UID:w', 'SUMMARY:Daily', 'DTSTART;TZID=Europe/Madrid:20260928T090000', 'DTEND;TZID=Europe/Madrid:20260928T093000', 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=6', 'EXDATE;TZID=Europe/Madrid:20261005T090000')));
    // 28/9 L, 30/9 X, 5/10 L (excluido), 7/10 X, 12/10 L, 14/10 X  (COUNT=6 incluye el excluido)
    expect(r.events.map((e) => e.startsAt.toISOString().slice(0, 10))).toEqual(['2026-09-28', '2026-09-30', '2026-10-07', '2026-10-12', '2026-10-14']);
    expect(r.events[0]!.startsAt.toISOString()).toBe('2026-09-28T07:00:00.000Z');
  });
  it('mantiene la hora local a través del cambio de horario', () => {
    const r = parseIcs(wrap(ev('UID:d', 'SUMMARY:X', 'DTSTART;TZID=Europe/Madrid:20261022T100000', 'DTEND;TZID=Europe/Madrid:20261022T110000', 'RRULE:FREQ=DAILY;COUNT=6')), { defaultTz: 'Europe/Madrid', now: NOW });
    expect(r.events.map((e) => e.startsAt.toISOString())).toEqual(['2026-10-22T08:00:00.000Z', '2026-10-23T08:00:00.000Z', '2026-10-24T08:00:00.000Z', '2026-10-25T09:00:00.000Z', '2026-10-26T09:00:00.000Z', '2026-10-27T09:00:00.000Z']);
  });
  it('mensual (salta meses sin ese día), anual y UNTIL', () => {
    const m = parse(wrap(ev('UID:m', 'SUMMARY:M', 'DTSTART:20260131T100000Z', 'DTEND:20260131T110000Z', 'RRULE:FREQ=MONTHLY;COUNT=12')));
    // COUNT cuenta apariciones reales: los meses sin día 31 se saltan (no cuentan) y se sigue hasta el final de la ventana.
    expect(m.events.slice(0, 3).map((e) => e.startsAt.toISOString().slice(0, 10))).toEqual(['2026-10-31', '2026-12-31', '2027-01-31']);
    expect(m.events.some((e) => ['-02-', '-04-', '-06-', '-09-', '-11-'].some((x) => e.startsAt.toISOString().includes(x)))).toBe(false);
    const y = parse(wrap(ev('UID:y', 'SUMMARY:Y', 'DTSTART;VALUE=DATE:20200314', 'RRULE:FREQ=YEARLY')));
    expect(y.events.map((e) => e.startsAt.toISOString().slice(0, 10))).toEqual(['2027-03-13']); // 14/3 local = 13/3 22:00Z
    const u = parse(wrap(ev('UID:u', 'SUMMARY:U', 'DTSTART:20261006T080000Z', 'DTEND:20261006T090000Z', 'RRULE:FREQ=DAILY;UNTIL=20261008T235959Z')));
    expect(u.events).toHaveLength(3);
  });
  it('RECURRENCE-ID sustituye solo esa instancia', () => {
    const r = parse(wrap(
      ev('UID:r', 'SUMMARY:Serie', 'DTSTART:20261006T080000Z', 'DTEND:20261006T090000Z', 'RRULE:FREQ=DAILY;COUNT=3'),
      ev('UID:r', 'SUMMARY:Movida', 'RECURRENCE-ID:20261007T080000Z', 'DTSTART:20261007T150000Z', 'DTEND:20261007T160000Z'),
    ));
    expect(r.events.map((e) => `${e.title}@${e.startsAt.toISOString().slice(0, 13)}`)).toEqual(['Serie@2026-10-06T08', 'Movida@2026-10-07T15', 'Serie@2026-10-08T08']);
  });
  it('una serie enorme no desborda (límite de instancias)', () => {
    const r = parseIcs(wrap(ev('UID:big', 'SUMMARY:B', 'DTSTART:20200101T080000Z', 'DTEND:20200101T090000Z', 'RRULE:FREQ=DAILY')), { defaultTz: 'UTC', now: NOW });
    expect(r.events.length).toBeLessThanOrEqual(300);
    expect(r.events.length).toBeGreaterThan(300 - 1);
  });
});
