/**
 * Zona horaria del usuario. El servidor corre en UTC; el navegador envía su `Date.getTimezoneOffset()`
 * (minutos, UTC − local; p. ej. −120 en verano en Madrid) para interpretar «mañana» o «a las 10» como espera el usuario.
 */
export const clampOffset = (n: unknown): number => {
  const v = Number(n);
  return Number.isFinite(v) && Math.abs(v) <= 840 ? Math.trunc(v) : 0;
};

/** 'YYYY-MM-DD' del día local de `d`. */
export const localKey = (d: Date, offset: number) => new Date(d.getTime() - offset * 60_000).toISOString().slice(0, 10);

/** Instante UTC de una fecha y hora locales. */
export const localToUtc = (key: string, time: string, offset: number) => new Date(Date.parse(`${key}T${time}:00.000Z`) + offset * 60_000);

export const addDaysKey = (key: string, n: number) => {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** 0 = domingo … 6 = sábado. */
export const weekdayOf = (key: string) => new Date(`${key}T12:00:00Z`).getUTCDay();

/** Inicio y fin (UTC) del día local `key`. */
export const dayBoundsUtc = (key: string, offset: number) => ({ from: localToUtc(key, '00:00', offset), to: new Date(localToUtc(key, '00:00', offset).getTime() + 86_400_000 - 1) });

export const fmtLocalTime = (d: Date, offset: number) => new Date(d.getTime() - offset * 60_000).toISOString().slice(11, 16);
export const fmtLocalDay = (key: string) => {
  const t = new Date(`${key}T12:00:00Z`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  return t.charAt(0).toUpperCase() + t.slice(1);
};
