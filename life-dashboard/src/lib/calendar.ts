export type CalendarViewKind = 'day' | 'week' | 'month' | 'agenda';

const DAY = 86_400_000;
export const startOfDayLocal = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDaysLocal = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
/** Lunes como primer día de la semana. */
export const startOfWeek = (d: Date) => addDaysLocal(startOfDayLocal(d), -((d.getDay() + 6) % 7));
export const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Rango visible [from, to) para cada vista. */
export function viewRange(view: CalendarViewKind, date: Date): { from: Date; to: Date } {
  const d = startOfDayLocal(date);
  if (view === 'day') return { from: d, to: addDaysLocal(d, 1) };
  if (view === 'week') { const s = startOfWeek(d); return { from: s, to: addDaysLocal(s, 7) }; }
  if (view === 'month') {
    const first = new Date(d.getFullYear(), d.getMonth(), 1);
    const s = startOfWeek(first);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return { from: s, to: addDaysLocal(startOfWeek(last), 7) };
  }
  return { from: d, to: addDaysLocal(d, 60) };
}

/** Mueve la fecha de referencia una unidad de la vista. */
export function shiftDate(view: CalendarViewKind, date: Date, dir: -1 | 1): Date {
  if (view === 'day') return addDaysLocal(date, dir);
  if (view === 'week') return addDaysLocal(date, 7 * dir);
  if (view === 'month') return new Date(date.getFullYear(), date.getMonth() + dir, 1);
  return addDaysLocal(date, 30 * dir);
}

export interface Span { id: string; start: Date; end: Date }
export interface Placed<T extends Span> { item: T; col: number; cols: number; top: number; height: number }

/**
 * Coloca eventos de un día en columnas para que los solapados no se tapen.
 * top/height en porcentaje de las 24 h (los eventos que cruzan medianoche se recortan al día).
 */
export function layoutDay<T extends Span>(items: T[], day: Date): Placed<T>[] {
  const ds = startOfDayLocal(day).getTime();
  const de = ds + DAY;
  const clipped = items
    .filter((e) => e.end.getTime() > ds && e.start.getTime() < de)
    .map((item) => ({ item, s: Math.max(item.start.getTime(), ds), e: Math.min(Math.max(item.end.getTime(), item.start.getTime() + 15 * 60_000), de) }))
    .sort((a, b) => a.s - b.s || b.e - a.e);

  const out: Placed<T>[] = [];
  let cluster: typeof clipped = [];
  let clusterEnd = -Infinity;
  const flush = () => {
    const colEnds: number[] = [];
    const placed = cluster.map((c) => {
      let col = colEnds.findIndex((end) => end <= c.s);
      if (col === -1) { col = colEnds.length; colEnds.push(c.e); } else colEnds[col] = c.e;
      return { c, col };
    });
    for (const { c, col } of placed) out.push({ item: c.item, col, cols: colEnds.length, top: ((c.s - ds) / DAY) * 100, height: ((c.e - c.s) / DAY) * 100 });
    cluster = []; clusterEnd = -Infinity;
  };
  for (const c of clipped) {
    if (cluster.length && c.s >= clusterEnd) flush();
    cluster.push(c);
    clusterEnd = Math.max(clusterEnd, c.e);
  }
  if (cluster.length) flush();
  return out;
}
