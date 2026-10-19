import { beforeEach, describe, expect, it } from 'vitest';
import { automationSchema } from '@/lib/automation-schema';
import { describeAutomation } from '@/lib/automations';
import { db } from '@/lib/db';
import { confirmProposal } from '../ai/proposals';
import type { AIContext } from '../providers/types';
import { previewAutomation, runAutomations } from './engine';
import { createAutomation, deleteAutomation, MAX_AUTOMATIONS, setAutomationEnabled, updateAutomation } from './service';

const NOW = new Date('2026-10-05T06:00:00Z'); // lunes
let alice: AIContext, bob: AIContext;
const ctxOf = (userId: string): AIContext => ({ userId, now: NOW, tzOffset: -120 });
const noon = (n: number) => new Date(Date.UTC(2026, 9, 5 + n, 12));
const auto = (o: Record<string, unknown>) => ({ name: 'Regla', triggerType: 'task_overdue', actionType: 'notify', ...o });
const notes = (userId: string) => db.notification.findMany({ where: { userId, type: 'automation' }, orderBy: { createdAt: 'asc' } });

beforeEach(async () => {
  await db.user.deleteMany();
  const mk = (n: string) => db.user.create({ data: { email: `${n}@test.dev`, name: n, passwordHash: 'x' } }).then((u) => u.id);
  alice = ctxOf(await mk('alice')); bob = ctxOf(await mk('bob'));
  await db.task.createMany({ data: [
    { userId: alice.userId, title: 'Impuestos', status: 'next', dueDate: noon(-2) },
    { userId: alice.userId, title: 'Hoy no vence', status: 'next', dueDate: noon(0) },
    { userId: alice.userId, title: 'Hecha', status: 'done', dueDate: noon(-5) },
    { userId: bob.userId, title: 'De Bob', status: 'next', dueDate: noon(-9) },
  ] });
});

describe('validación', () => {
  it('rechaza configuraciones inválidas y combinaciones no permitidas', () => {
    expect(automationSchema.safeParse(auto({ triggerType: 'rayo' })).success).toBe(false);
    expect(automationSchema.safeParse(auto({ triggerType: 'budget_alert', triggerConfig: { threshold: 50 } })).success).toBe(false);
    expect(automationSchema.safeParse(auto({ triggerType: 'birthday_soon', triggerConfig: { days: 99 } })).success).toBe(false);
    expect(automationSchema.safeParse(auto({ actionType: 'digest' })).success).toBe(false); // digest solo con weekly
    expect(automationSchema.safeParse(auto({ actionType: 'create_task', actionConfig: { titleTemplate: '' } })).success).toBe(false);
    const ok = automationSchema.parse(auto({ triggerType: 'weekly', triggerConfig: {}, actionType: 'digest' }));
    expect(ok.triggerConfig).toEqual({ weekday: 1 }); // valores por defecto
    expect(ok.requiresConfirmation).toBe(true); // seguro por defecto
  });
  it('describe la regla en una frase', () => {
    expect(describeAutomation({ triggerType: 'birthday_soon', triggerConfig: { days: 7 }, actionType: 'create_task', actionConfig: {}, requiresConfirmation: true })).toBe('Cuando faltan 7 días o menos para un cumpleaños → proponerte crear una tarea (la confirmas tú)');
  });
});

describe('ejecución', () => {
  it('notifica una sola vez por tarea atrasada (idempotente, también en paralelo) y solo de este usuario', async () => {
    await createAutomation(alice.userId, auto({}));
    await createAutomation(bob.userId, auto({ name: 'De Bob' }));
    await Promise.all([runAutomations(alice), runAutomations(alice)]);
    const [r] = await runAutomations(alice);
    expect(r).toMatchObject({ matched: 1, fired: 0 });
    const n = await notes(alice.userId);
    expect(n.map((x) => x.title)).toEqual(['Tarea atrasada: Impuestos']);
    expect(await notes(bob.userId)).toHaveLength(0); // no se ejecutó la de Bob
    expect(await db.automationRun.count()).toBe(1);
  });
  it('una tarea nueva atrasada dispara de nuevo solo por la nueva', async () => {
    await createAutomation(alice.userId, auto({}));
    await runAutomations(alice);
    await db.task.create({ data: { userId: alice.userId, title: 'Otra', status: 'next', dueDate: noon(-1) } });
    await runAutomations(alice);
    expect((await notes(alice.userId)).map((x) => x.title)).toEqual(['Tarea atrasada: Impuestos', 'Tarea atrasada: Otra']);
  });
  it('desactivada no se ejecuta; borrar o editar reinicia', async () => {
    const id = await createAutomation(alice.userId, auto({}));
    await setAutomationEnabled(alice.userId, id, false);
    expect(await runAutomations(alice)).toEqual([]);
    await setAutomationEnabled(alice.userId, id, true);
    await runAutomations(alice);
    await updateAutomation(alice.userId, id, auto({ name: 'Editada' }));
    expect(await db.automationRun.count()).toBe(0);
    await runAutomations(alice);
    expect(await notes(alice.userId)).toHaveLength(2); // vuelve a avisar tras editar
  });
  it('crear tarea con confirmación genera propuesta (no tarea); sin confirmación crea directamente', async () => {
    await db.familyMember.create({ data: { userId: alice.userId, name: 'Mamá', relation: 'Madre', birthday: new Date(Date.UTC(1962, 9, 9, 12)) } });
    const id = await createAutomation(alice.userId, auto({ name: 'Regalos', triggerType: 'birthday_soon', triggerConfig: { days: 7 }, actionType: 'create_task', actionConfig: { titleTemplate: 'Comprar regalo: {subject}' } }));
    const [r] = await runAutomations(alice);
    expect(r).toMatchObject({ fired: 1, proposals: 1 });
    expect(await db.task.count({ where: { title: 'Comprar regalo: Mamá' } })).toBe(0);
    const p = await db.aIProposal.findFirstOrThrow({ where: { userId: alice.userId } });
    expect(p).toMatchObject({ status: 'pending', source: 'automation', tool: 'create_task' });
    await confirmProposal(alice.userId, p.id, 0, NOW);
    expect(await db.task.count({ where: { title: 'Comprar regalo: Mamá' } })).toBe(1);
    // Sin confirmación (el usuario lo desactivó explícitamente)
    await db.automationRun.deleteMany();
    await updateAutomation(alice.userId, id, auto({ name: 'Regalos', triggerType: 'birthday_soon', triggerConfig: { days: 7 }, actionType: 'create_task', actionConfig: { titleTemplate: 'Directa: {subject}' }, requiresConfirmation: false }));
    await runAutomations(alice);
    expect(await db.task.count({ where: { title: 'Directa: Mamá' } })).toBe(1);
  });
  it('resumen semanal: solo el día elegido, una vez por semana', async () => {
    await createAutomation(alice.userId, auto({ name: 'Lunes', triggerType: 'weekly', triggerConfig: { weekday: 1 }, actionType: 'digest' }));
    await createAutomation(alice.userId, auto({ name: 'Viernes', triggerType: 'weekly', triggerConfig: { weekday: 5 }, actionType: 'digest' }));
    await runAutomations(alice); await runAutomations(alice);
    expect((await notes(alice.userId)).map((n) => n.title)).toEqual(['Lunes']);
    const nextWeek = { ...alice, now: new Date('2026-10-12T06:00:00Z') };
    await runAutomations(nextWeek);
    expect((await notes(alice.userId)).map((n) => n.title)).toEqual(['Lunes', 'Lunes']);
  });
  it('presupuestos, emails y viajes', async () => {
    const acc = await db.bankAccount.create({ data: { ownerId: alice.userId, name: 'C', kind: 'checking', openingBalance: 0 } });
    await db.budget.create({ data: { userId: alice.userId, category: 'ocio', monthly: 100 } });
    await db.transaction.create({ data: { accountId: acc.id, userId: alice.userId, date: noon(-1), amount: -120, category: 'ocio', description: 'Cine y cena' } });
    await db.email.create({ data: { userId: alice.userId, fromName: 'Ana', fromEmail: 'a@x.dev', subject: 'Contrato', snippet: 's', body: 'b', receivedAt: NOW, needsReply: true, deadline: noon(1) } });
    const trip = await db.trip.create({ data: { userId: alice.userId, name: 'Lisboa', destination: 'Lisboa', startDate: noon(3), endDate: noon(6) } });
    await db.packingItem.create({ data: { tripId: trip.id, label: 'Pasaporte' } });
    await createAutomation(alice.userId, auto({ name: 'B', triggerType: 'budget_alert', triggerConfig: { threshold: 100 } }));
    await createAutomation(alice.userId, auto({ name: 'E', triggerType: 'email_needs_reply', triggerConfig: { days: 2 } }));
    await createAutomation(alice.userId, auto({ name: 'T', triggerType: 'trip_soon', triggerConfig: { days: 7 } }));
    const reports = await runAutomations(alice);
    expect(reports.map((r) => [r.name, r.fired])).toEqual([['B', 1], ['E', 1], ['T', 1]]);
    expect((await notes(alice.userId)).map((n) => n.title).sort()).toEqual(['Prepara la maleta de Lisboa', 'Presupuesto de ocio superado', 'Responder a Ana']);
  });
  it('la vista previa no tiene efectos y marca lo ya disparado', async () => {
    const id = await createAutomation(alice.userId, auto({}));
    const before = await previewAutomation(alice, id);
    expect(before.matches).toEqual([{ title: 'Tarea atrasada: Impuestos', body: 'Venció el 03/10/2026', alreadyFired: false }]);
    expect(await notes(alice.userId)).toHaveLength(0);
    await runAutomations(alice);
    expect((await previewAutomation(alice, id)).matches[0]!.alreadyFired).toBe(true);
    await expect(previewAutomation(bob, id)).rejects.toThrow(/no encontrada/);
  });
});

describe('aislamiento y límites', () => {
  it('otro usuario no puede editar, activar ni borrar', async () => {
    const id = await createAutomation(alice.userId, auto({}));
    await expect(updateAutomation(bob.userId, id, auto({ name: 'x' }))).rejects.toThrow(/no encontrada/);
    await expect(setAutomationEnabled(bob.userId, id, false)).rejects.toThrow();
    await expect(deleteAutomation(bob.userId, id)).rejects.toThrow();
    expect(await db.automation.count()).toBe(1);
  });
  it('máximo de automatizaciones', async () => {
    for (let i = 0; i < MAX_AUTOMATIONS; i++) await createAutomation(alice.userId, auto({ name: `R${i}` }));
    await expect(createAutomation(alice.userId, auto({ name: 'una más' }))).rejects.toThrow(/máximo/);
  });
});
