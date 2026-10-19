export const TRIGGER_TYPES = ['task_overdue', 'budget_alert', 'birthday_soon', 'email_needs_reply', 'trip_soon', 'weekly'] as const;
export const ACTION_TYPES = ['notify', 'create_task', 'digest'] as const;
export type TriggerType = (typeof TRIGGER_TYPES)[number];
export type ActionType = (typeof ACTION_TYPES)[number];

export const TRIGGER_LABEL: Record<TriggerType, string> = {
  task_overdue: 'una tarea se atrasa', budget_alert: 'un presupuesto se acerca o supera el límite', birthday_soon: 'se acerca un cumpleaños',
  email_needs_reply: 'un email por responder vence pronto', trip_soon: 'se acerca un viaje con la maleta sin hacer', weekly: 'llega cierto día de la semana',
};
export const ACTION_LABEL: Record<ActionType, string> = { notify: 'avisarme con una notificación', create_task: 'crear una tarea', digest: 'enviarme un resumen' };
export const WEEKDAY_LABEL = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

/** «Cuando X → entonces Y» en una frase legible. */
export function describeAutomation(a: { triggerType: string; triggerConfig: unknown; actionType: string; actionConfig: unknown; requiresConfirmation: boolean }): string {
  const tc = (a.triggerConfig ?? {}) as Record<string, number>;
  const cuando: Record<string, string> = {
    task_overdue: 'una tarea se atrasa', budget_alert: `un presupuesto llega al ${tc.threshold ?? 100} %`, birthday_soon: `faltan ${tc.days ?? 7} días o menos para un cumpleaños`,
    email_needs_reply: `un email por responder vence en ${tc.days ?? 2} días o menos`, trip_soon: `un viaje sale en ${tc.days ?? 7} días o menos y la maleta no está lista`, weekly: `es ${WEEKDAY_LABEL[tc.weekday ?? 1] ?? 'lunes'}`,
  };
  const entonces: Record<string, string> = { notify: 'avisarme', create_task: a.requiresConfirmation ? 'proponerte crear una tarea (la confirmas tú)' : 'crear una tarea', digest: 'enviarte un resumen de tus prioridades' };
  return `Cuando ${cuando[a.triggerType] ?? a.triggerType} → ${entonces[a.actionType] ?? a.actionType}`;
}

export const AUTOMATION_TEMPLATES: { name: string; triggerType: TriggerType; triggerConfig: Record<string, unknown>; actionType: ActionType; actionConfig: Record<string, unknown>; requiresConfirmation: boolean }[] = [
  { name: 'Aviso de tareas atrasadas', triggerType: 'task_overdue', triggerConfig: {}, actionType: 'notify', actionConfig: {}, requiresConfirmation: false },
  { name: 'Alerta de presupuesto superado', triggerType: 'budget_alert', triggerConfig: { threshold: 100 }, actionType: 'notify', actionConfig: {}, requiresConfirmation: false },
  { name: 'Recordar cumpleaños con regalo', triggerType: 'birthday_soon', triggerConfig: { days: 7 }, actionType: 'create_task', actionConfig: { titleTemplate: 'Comprar regalo: {subject}' }, requiresConfirmation: true },
  { name: 'Resumen semanal de los lunes', triggerType: 'weekly', triggerConfig: { weekday: 1 }, actionType: 'digest', actionConfig: {}, requiresConfirmation: false },
];
