import { describe, expect, it } from 'vitest';
import { buildPriorities, detectConflicts, recommendNextAction, unusualSpending, type EventLite, type TaskLite } from './insights';

const now = new Date(2026, 9, 4, 10, 0);
const at = (h: number, m = 0, dayOffset = 0) => new Date(2026, 9, 4 + dayOffset, h, m);
const task = (o: Partial<TaskLite> & { id: string }): TaskLite => ({ title: o.id, priority: 2, status: 'next', dueDate: null, estimateMinutes: 30, ...o });
const ev = (id: string, s: Date, e: Date, o: Partial<EventLite> = {}): EventLite => ({ id, title: id, startsAt: s, endsAt: e, ...o });

describe('detectConflicts', () => {
  it('detecta solapes y no cuenta eventos consecutivos', () => {
    const c = detectConflicts([ev('a', at(10), at(11)), ev('b', at(10, 30), at(12)), ev('c', at(12), at(13))]);
    expect(c.map(([x, y]) => x.id + y.id)).toEqual(['ab']);
  });
});

describe('unusualSpending', () => {
  it('marca categorías muy por encima de la media', () => {
    const spend = [
      { category: 'ocio', amount: -300, date: new Date(2026, 9, 2) },
      { category: 'ocio', amount: -60, date: new Date(2026, 8, 2) },
      { category: 'ocio', amount: -60, date: new Date(2026, 7, 2) },
      { category: 'ocio', amount: -60, date: new Date(2026, 6, 2) },
      { category: 'vivienda', amount: -800, date: new Date(2026, 9, 1) },
      { category: 'vivienda', amount: -800, date: new Date(2026, 8, 1) },
    ];
    expect(unusualSpending(spend, now).map((u) => u.category)).toEqual(['ocio']);
  });
});

describe('recommendNextAction', () => {
  it('elige la tarea atrasada que cabe en el hueco', () => {
    const tasks = [
      task({ id: 'larga', priority: 1, estimateMinutes: 120 }),
      task({ id: 'atrasada', priority: 2, dueDate: at(9, 0, -2), estimateMinutes: 40 }),
    ];
    const r = recommendNextAction({ now, tasks, events: [ev('reunion', at(10, 45), at(11, 30))] });
    expect(r.taskId).toBe('atrasada');
    expect(r.message).toContain('45 minutos');
  });
  it('habla de bloque largo si el hueco supera 3 h y pluraliza bien', () => {
    const r = recommendNextAction({ now, tasks: [task({ id: 'x' })], events: [ev('manana', at(10, 0, 1), at(11, 0, 1))] });
    expect(r.message).toContain('bloque largo');
    const p = buildPriorities({ now, tasks: [task({ id: 'y', dueDate: at(9, 0, -1) })], emails: [], events: [], upcomingPayments: [], spend: [] });
    expect(p[0]?.detail).toBe('Atrasada 1 día');
  });
  it('informa si estás en un evento', () => {
    expect(recommendNextAction({ now, tasks: [], events: [ev('x', at(9, 30), at(10, 30))] }).kind).toBe('event');
  });
  it('sugiere descanso sin tareas', () => {
    expect(recommendNextAction({ now, tasks: [], events: [] }).kind).toBe('rest');
  });
});

describe('buildPriorities', () => {
  it('ordena urgentes primero e incluye tareas atrasadas y pagos próximos', () => {
    const items = buildPriorities({
      now,
      tasks: [task({ id: 't1', dueDate: at(9, 0, -1) })],
      emails: [{ id: 'e1', subject: 'Contrato', fromName: 'Ana', needsReply: true, replied: false, deadline: at(9, 0, 5), important: true }],
      events: [],
      upcomingPayments: [{ id: 'p1', description: 'Seguro', amount: -120, date: at(9, 0, 1) }],
      spend: [],
    });
    expect(items[0]?.severity).toBe('urgent');
    expect(items.map((i) => i.kind)).toEqual(expect.arrayContaining(['task', 'payment', 'email']));
  });
});
