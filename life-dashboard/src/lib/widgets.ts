export type WidgetSize = 'sm' | 'md' | 'lg';
export interface WidgetState { id: string; visible: boolean; order: number; size: WidgetSize }

export const WIDGETS: { id: string; title: string; size: WidgetSize }[] = [
  // Tamaños pensados para que cada fila de 3 columnas (xl) quede completa.
  { id: 'myday', title: 'Mi día', size: 'sm' },
  { id: 'priorities', title: 'Prioridades', size: 'md' },
  { id: 'nextaction', title: '¿Qué debería hacer ahora?', size: 'md' },
  { id: 'calendar', title: 'Calendario', size: 'sm' },
  { id: 'email', title: 'Email', size: 'sm' },
  { id: 'tasks', title: 'Tareas', size: 'sm' },
  { id: 'projects', title: 'Proyectos', size: 'sm' },
  { id: 'news', title: 'Lo importante de hoy', size: 'md' },
  { id: 'investments', title: 'Inversiones', size: 'sm' },
  { id: 'finance', title: 'Finanzas', size: 'md' },
  { id: 'health', title: 'Salud', size: 'sm' },
  { id: 'travel', title: 'Viajes', size: 'sm' },
  { id: 'notifications', title: 'Notificaciones', size: 'sm' },
  { id: 'ai', title: 'Asistente IA', size: 'sm' },
];

export const defaultLayout = (): WidgetState[] => WIDGETS.map((w, order) => ({ id: w.id, visible: true, order, size: w.size }));

/** Combina el layout guardado con el catálogo: descarta widgets desconocidos, añade los nuevos y normaliza el orden. */
export function mergeLayout(saved: WidgetState[] | null | undefined): WidgetState[] {
  const defaults = defaultLayout();
  if (!saved?.length) return defaults;
  const known = new Map(defaults.map((d) => [d.id, d]));
  const kept = saved.filter((s) => known.has(s.id)).sort((a, b) => a.order - b.order);
  const seen = new Set(kept.map((k) => k.id));
  const added = defaults.filter((d) => !seen.has(d.id));
  return [...kept, ...added].map((w, order) => ({ ...w, order }));
}
