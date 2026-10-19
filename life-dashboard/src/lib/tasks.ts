export const TASK_STATUSES = ['inbox', 'next', 'in_progress', 'waiting', 'done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const STATUS_LABEL: Record<TaskStatus, string> = { inbox: 'Inbox', next: 'Próxima', in_progress: 'En progreso', waiting: 'Esperando', done: 'Completada' };
export const PRIORITY_LABEL: Record<number, string> = { 1: 'Alta', 2: 'Media', 3: 'Baja' };
export const RECURRENCES = ['daily', 'weekly', 'monthly'] as const;
export type Recurrence = (typeof RECURRENCES)[number];
export const RECURRENCE_LABEL: Record<Recurrence, string> = { daily: 'Cada día', weekly: 'Cada semana', monthly: 'Cada mes' };

/** Siguiente vencimiento de una tarea recurrente. Trabaja en UTC (las fechas de tarea se guardan a las 12:00 UTC). */
export function nextOccurrence(due: Date, recurrence: Recurrence): Date {
  const d = new Date(due);
  if (recurrence === 'daily') d.setUTCDate(d.getUTCDate() + 1);
  else if (recurrence === 'weekly') d.setUTCDate(d.getUTCDate() + 7);
  else {
    // Mensual conservando el día; si el mes siguiente es más corto (31 → 28/30) se ajusta al último día.
    const day = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + 1);
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(day, last));
  }
  return d;
}

/** 'YYYY-MM-DD' → Date a las 12:00 UTC (inmune a husos horarios). */
export const dateOnlyToDate = (s: string) => new Date(`${s}T12:00:00.000Z`);
export const dateToDateOnly = (d: Date | string | null) => (d ? new Date(d).toISOString().slice(0, 10) : '');

export function parseTags(raw: string): string[] {
  return [...new Set(raw.split(/[,\s]+/).map((t) => t.replace(/^#/, '').trim().toLowerCase()).filter(Boolean))].slice(0, 10);
}
