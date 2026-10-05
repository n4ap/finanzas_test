export const PROJECT_STATUSES = ['planned', 'active', 'paused', 'done'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = { planned: 'Planificado', active: 'Activo', paused: 'En pausa', done: 'Completado' };
export const PROJECT_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#0ea5e9', '#64748b'] as const;

export type ProjectHealth = 'empty' | 'done' | 'paused' | 'late' | 'at_risk' | 'on_track';
export const PROJECT_HEALTH_LABEL: Record<ProjectHealth, string> = {
  empty: 'Sin tareas', done: 'Completado', paused: 'En pausa', late: 'Fuera de plazo', at_risk: 'En riesgo', on_track: 'En marcha',
};

export interface ProjectTaskLite { status: string; dueDate: Date | null }
export interface ProjectStats { total: number; done: number; open: number; overdue: number; progress: number; health: ProjectHealth; reason: string }

const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const localKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Progreso y estado de un proyecto, derivados SOLO de sus tareas raíz (sin porcentaje manual que se quede desfasado).
 * - late: fecha objetivo vencida con tareas abiertas.
 * - at_risk: tareas atrasadas, o ritmo muy por debajo del tiempo transcurrido (más de 25 puntos).
 * `reason` explica el estado en una frase, para no depender solo del color.
 */
export function projectStats(tasks: ProjectTaskLite[], p: { status: string; targetDate: Date | null; createdAt: Date }, now: Date): ProjectStats {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'done').length;
  const open = total - done;
  const today = localKey(now);
  const overdue = tasks.filter((t) => t.status !== 'done' && t.dueDate && dayKey(t.dueDate) < today).length;
  const progress = total ? done / total : 0;
  const base = { total, done, open, overdue, progress };

  if (p.status === 'done' || (total > 0 && open === 0)) return { ...base, health: 'done', reason: 'Todas las tareas completadas' };
  if (p.status === 'paused') return { ...base, health: 'paused', reason: 'Proyecto en pausa' };
  if (total === 0) return { ...base, health: 'empty', reason: 'Añade tareas para medir el avance' };
  if (p.targetDate && dayKey(p.targetDate) < today) return { ...base, health: 'late', reason: `Fecha objetivo vencida con ${open} ${open === 1 ? 'tarea abierta' : 'tareas abiertas'}` };
  if (overdue > 0) return { ...base, health: 'at_risk', reason: overdue === 1 ? '1 tarea atrasada' : `${overdue} tareas atrasadas` };
  if (p.targetDate) {
    const span = p.targetDate.getTime() - p.createdAt.getTime();
    const elapsed = span > 0 ? Math.min(1, Math.max(0, (now.getTime() - p.createdAt.getTime()) / span)) : 1;
    if (elapsed - progress > 0.25 && elapsed > 0.3) return { ...base, health: 'at_risk', reason: `Has gastado el ${Math.round(elapsed * 100)} % del plazo con un ${Math.round(progress * 100)} % hecho` };
  }
  return { ...base, health: 'on_track', reason: `${done} de ${total} ${total === 1 ? 'tarea hecha' : 'tareas hechas'}` };
}
