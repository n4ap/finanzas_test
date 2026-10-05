export interface BirthdayInfo { date: Date; daysUntil: number; turning: number }

/**
 * Próximo cumpleaños. El cumpleaños se guarda como fecha (mediodía UTC); se lee en UTC.
 * El 29 de febrero se celebra el 28 en años no bisiestos.
 */
export function nextBirthday(birthday: Date, now: Date): BirthdayInfo {
  const m = birthday.getUTCMonth();
  const d = birthday.getUTCDate();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const at = (year: number) => {
    const isLeap = new Date(Date.UTC(year, 1, 29)).getUTCMonth() === 1;
    return new Date(Date.UTC(year, m, m === 1 && d === 29 && !isLeap ? 28 : d, 12));
  };
  let year = now.getFullYear();
  let next = at(year);
  if (Date.UTC(next.getUTCFullYear(), next.getUTCMonth(), next.getUTCDate()) < today) { year += 1; next = at(year); }
  const next0 = Date.UTC(next.getUTCFullYear(), next.getUTCMonth(), next.getUTCDate());
  return { date: next, daysUntil: Math.round((next0 - today) / 86_400_000), turning: year - birthday.getUTCFullYear() };
}

export const birthdayLabel = (days: number) => (days === 0 ? 'Hoy' : days === 1 ? 'Mañana' : `En ${days} días`);

export const FAMILY_COLORS = ['#ec4899', '#10b981', '#f59e0b', '#6366f1', '#0ea5e9', '#64748b'] as const;
export const RELATIONS = ['Pareja', 'Madre', 'Padre', 'Hijo/a', 'Hermano/a', 'Abuelo/a', 'Sobrino/a', 'Amigo/a', 'Otro'] as const;
