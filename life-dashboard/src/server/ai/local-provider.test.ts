import { describe, expect, it } from 'vitest';
import type { AIContext, AIMessageDTO } from '../providers/types';
import { detectIntent, localProvider } from './local-provider';

// Lunes 5 oct 2026, 08:00 Madrid (UTC+2)
const ctx: AIContext = { userId: 'u', now: new Date('2026-10-05T06:00:00Z'), tzOffset: -120 };
const ask = (text: string, extra: AIMessageDTO[] = []) => localProvider.respond({ ctx, history: [{ role: 'user', content: text }, ...extra], tools: [] });
const tool = (name: string, data: unknown): AIMessageDTO => ({ role: 'tool', content: JSON.stringify(data), toolName: name, toolCallId: `call_${name}_0` });
const asst = (name: string): AIMessageDTO => ({ role: 'assistant', content: '', toolCalls: [{ id: `call_${name}_0`, name, args: {} }] });

describe('detectIntent', () => {
  it.each([
    ['¿Qué tengo mañana?', 'agenda'], ['agenda de la semana', 'agenda'], ['tareas atrasadas', 'tasks'], ['¿Cuánto he gastado este mes?', 'spending'],
    ['próximos pagos', 'payments'], ['cómo van mis inversiones', 'portfolio'], ['mi salud', 'health'], ['mis viajes', 'trips'], ['próximos cumpleaños', 'birthdays'],
    ['¿qué es lo más importante?', 'priorities'], ['emails por responder', 'emails'], ['crea una tarea llamar al dentista', 'task_create'], ['recuérdame pagar el seguro', 'task_create'],
    ['reunión con Marta mañana a las 10', 'event'], ['añade leche y pan a la compra', 'shopping'], ['completa la tarea de impuestos', 'complete'], ['organízame la semana', 'weekplan'],
    ['hola', 'greeting'], ['blablabla xyz', 'unknown'],
  ])('«%s» → %s', (t, i) => expect(detectIntent(t)).toBe(i));
});

describe('localProvider: primera vuelta', () => {
  it('«¿Qué tengo mañana?» pide get_agenda de mañana', async () => {
    const r = await ask('¿Qué tengo mañana?');
    expect(r.toolCalls).toMatchObject([{ name: 'get_agenda', args: { from: '2026-10-06', days: 1 } }]);
  });
  it('crea tarea con fecha y prioridad', async () => {
    const r = await ask('crea una tarea urgente llamar al dentista el viernes');
    expect(r.toolCalls[0]).toMatchObject({ name: 'create_task', args: { title: 'Llamar al dentista', dueDate: '2026-10-09', priority: 1 } });
  });
  it('evento: convierte la hora local a UTC y pregunta si falta la hora o el día', async () => {
    const r = await ask('reunión con Marta mañana a las 10');
    expect(r.toolCalls[0]).toMatchObject({ name: 'create_event', args: { title: 'Reunión con Marta', startsAt: '2026-10-06T08:00:00.000Z', endsAt: '2026-10-06T09:00:00.000Z' } });
    expect((await ask('reunión con Marta mañana')).content).toMatch(/¿A qué hora/);
    expect((await ask('cita con el dentista')).content).toMatch(/¿Para qué día/);
  });
  it('compra: varios artículos', async () => {
    const r = await ask('añade leche, pan y tomates a la compra');
    expect(r.toolCalls.map((c) => (c.args as { label: string }).label)).toEqual(['Leche', 'Pan', 'Tomates']);
  });
  it('desconocido → ayuda honesta sobre sus límites', async () => {
    const r = await ask('háblame de física cuántica');
    expect(r.toolCalls).toEqual([]);
    expect(r.content).toMatch(/basado en reglas/);
  });
});

describe('completar: consulta de búsqueda', () => {
  it.each([
    ['completa la tarea de impuestos', 'impuestos'], ['marca como hecha la tarea de llamar al seguro del coche', 'llamar al seguro del coche'],
    ['he terminado el informe trimestral', 'informe trimestral'], ['completa impuestos como hecha', 'impuestos'], ['termina la tarea', ''],
  ])('«%s» → «%s»', async (text, q) => {
    const r = await ask(text);
    if (q) expect(r.toolCalls[0]).toMatchObject({ name: 'list_tasks', args: { query: q } }); else expect(r.content).toMatch(/¿Qué tarea/);
  });
});

describe('localProvider: redacción y siguientes pasos', () => {
  it('completar: una coincidencia → complete_task; ninguna → lo dice; varias → pide elegir', async () => {
    const t = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `id${i}`, title: `Impuestos ${i}` }));
    const one = await ask('completa la tarea de impuestos', [asst('list_tasks'), tool('list_tasks', { total: 1, tasks: t(1) })]);
    expect(one.toolCalls[0]).toMatchObject({ name: 'complete_task', args: { taskId: 'id0' } });
    const none = await ask('completa la tarea de impuestos', [asst('list_tasks'), tool('list_tasks', { total: 0, tasks: [] })]);
    expect(none.content).toMatch(/No encuentro/);
    const many = await ask('completa la tarea de impuestos', [asst('list_tasks'), tool('list_tasks', { total: 2, tasks: t(2) })]);
    expect(many.toolCalls).toEqual([]);
    expect(many.content).toMatch(/varias tareas/);
  });
  it('propuestas: avisa de que no se ejecutan hasta confirmar; errores se explican', async () => {
    const ok = await ask('crea una tarea x', [asst('create_task'), tool('create_task', { status: 'pending_confirmation', proposalId: 'p1', summary: 'Crear tarea «X»' })]);
    expect(ok.content).toMatch(/No se ejecuta hasta que la confirmes/);
    const bad = await ask('crea una tarea x', [asst('create_task'), tool('create_task', { error: 'Argumentos no válidos: título' })]);
    expect(bad.content).toMatch(/No he podido preparar la acción: Argumentos no válidos/);
  });
  it('gasto: cifras, categorías y alertas de presupuesto', async () => {
    const r = await ask('¿cuánto he gastado?', [asst('get_spending'), tool('get_spending', { month: '2026-10', income: 2650, expenses: 1483, saving: 1167, savingRate: 0.44, topCategories: [{ category: 'vivienda', amount: 780 }], budgetAlerts: [{ category: 'ocio', spent: 250, budget: 200, status: 'over' }], movements: 20 })]);
    expect(r.content).toMatch(/gastos 1\.483\s€/);
    expect(r.content).toMatch(/Vivienda 780\s€/);
    expect(r.content).toMatch(/Presupuesto de ocio: 250\s€ de 200\s€ \(superado\)/);
  });
  it('semana: ofrece reprogramar solo tareas sin fecha', async () => {
    const plan = { plan: [{ date: '2026-10-05', label: 'Lunes, 5 de octubre', tasks: [{ id: 'a', title: 'A', minutes: 30, needsDate: true, overdue: false }, { id: 'b', title: 'B', minutes: 30, needsDate: false, overdue: false }] }], unplaced: [], eventsCount: 0 };
    const r = await ask('organízame la semana', [asst('plan_week'), tool('plan_week', plan)]);
    expect(r.toolCalls[0]).toMatchObject({ name: 'schedule_tasks', args: { items: [{ taskId: 'a', dueDate: '2026-10-05' }] } });
  });
  it('un error de herramienta se comunica sin inventar datos', async () => {
    const r = await ask('mi salud', [asst('get_health'), tool('get_health', { error: 'fallo' })]);
    expect(r.content).toMatch(/No he podido consultarlo: fallo/);
  });
});
