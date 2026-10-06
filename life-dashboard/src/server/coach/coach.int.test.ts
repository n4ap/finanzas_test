import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { chat } from '../ai/orchestrator';
import { confirmProposal } from '../ai/proposals';
import { runScheduledTick } from '../jobs/scheduled';
import { exportUserData, importUserData } from '../settings/privacy';
import { getCoachData } from './queries';
import {
  createDecision, createGoal, deleteGoal, goalActionToTask, priorityToTask, saveAnswers, saveReview, setGoalProgress, updateDecision, updateGoal,
} from './service';

// Integración contra PostgreSQL real: cada usuario solo ve y toca su coach.
const NOW = new Date('2026-10-08T10:00:00Z'); // jueves, Madrid
let alice: string, bob: string;
const goal = (o: Record<string, unknown> = {}) => ({ level: 'quarterly', area: 'salud', title: 'Correr 10 km en < 55 min', metric: 'Tiempo 10 km', baseline: '62 min', target: '55 min', nextAction: 'Rodaje de 5 km el martes', dueDate: '2026-12-31', ...o });

beforeEach(async () => {
  await db.user.deleteMany();
  await db.jobRun.deleteMany();
  const mk = (n: string) => db.user.create({ data: { email: `${n}@test.dev`, name: n, passwordHash: 'x', timezone: 'Europe/Madrid' } }).then((u) => u.id);
  [alice, bob] = [await mk('alice'), await mk('bob')];
});

describe('entrevista', () => {
  it('guarda, edita y borra (respuesta vacía) solo claves conocidas', async () => {
    expect(await saveAnswers(alice, { answers: { h_sueno: '6 h', f_ahorro: '200 €' } })).toBe(2);
    await saveAnswers(alice, { answers: { h_sueno: '7 h', f_ahorro: '  ' } });
    const rows = await db.coachAnswer.findMany({ where: { userId: alice } });
    expect(rows.map((r) => [r.key, r.area, r.answer])).toEqual([['h_sueno', 'salud', '7 h']]);
    await expect(saveAnswers(alice, { answers: { inventada: 'x' } })).rejects.toThrow(/desconocida/);
    expect(await db.coachAnswer.count({ where: { userId: bob } })).toBe(0);
  });
});

describe('objetivos', () => {
  it('crea con validación y jerarquía coherente (el padre es de un nivel superior y del mismo usuario)', async () => {
    const annual = await createGoal(alice, goal({ level: 'annual', title: 'Estar en forma para el verano' }));
    const q = await createGoal(alice, goal({ parentId: annual }));
    expect((await db.goal.findUniqueOrThrow({ where: { id: q } })).parentId).toBe(annual);
    await expect(createGoal(alice, goal({ level: 'annual', parentId: q }))).rejects.toThrow(/nivel más amplio/);
    const bobs = await createGoal(bob, goal({ level: 'vision', title: 'Visión de Bob' }));
    await expect(createGoal(alice, goal({ parentId: bobs }))).rejects.toThrow(/no encontrado/);
    await expect(createGoal(alice, goal({ title: 'x' }))).rejects.toThrow(/Escribe el objetivo/);
    await expect(createGoal(alice, goal({ area: 'otra' }))).rejects.toThrow();
  });
  it('progreso, 100 % lo da por conseguido; nadie toca objetivos ajenos', async () => {
    const id = await createGoal(alice, goal());
    await setGoalProgress(alice, id, 100);
    expect(await db.goal.findUniqueOrThrow({ where: { id } })).toMatchObject({ progress: 100, status: 'done' });
    await expect(setGoalProgress(bob, id, 10)).rejects.toThrow(/no encontrado/);
    await expect(updateGoal(bob, id, goal())).rejects.toThrow(/no encontrado/);
    await expect(deleteGoal(bob, id)).rejects.toThrow(/no encontrado/);
    await expect(setGoalProgress(alice, id, 140)).rejects.toThrow(/Progreso/);
  });
  it('borrar un objetivo conserva sus dependientes (sin padre)', async () => {
    const annual = await createGoal(alice, goal({ level: 'annual' }));
    const q = await createGoal(alice, goal({ parentId: annual }));
    await deleteGoal(alice, annual);
    expect((await db.goal.findUniqueOrThrow({ where: { id: q } })).parentId).toBeNull();
  });
  it('la próxima acción se convierte en tarea con etiqueta coach', async () => {
    const id = await createGoal(alice, goal());
    const t = await goalActionToTask(alice, id, '2026-10-08');
    expect(await db.task.findUniqueOrThrow({ where: { id: t } })).toMatchObject({ userId: alice, title: 'Rodaje de 5 km el martes', priority: 1, tags: ['coach'] });
    await expect(goalActionToTask(bob, id)).rejects.toThrow(/no encontrado/);
  });
});

describe('revisiones', () => {
  it('una por periodo (se edita), la semanal se normaliza al lunes y valida rangos', async () => {
    await saveReview(alice, { kind: 'daily', period: '2026-10-08', answers: { logros: 'Entrené', manana: 'Informe' }, energy: 7, mood: 6, stress: 4 });
    await saveReview(alice, { kind: 'daily', period: '2026-10-08', answers: { logros: 'Entrené y leí' }, energy: 8, mood: 6, stress: 3 });
    const d = await db.review.findMany({ where: { userId: alice, kind: 'daily' } });
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ energy: 8, answers: { logros: 'Entrené y leí' } });
    await saveReview(alice, { kind: 'weekly', period: '2026-10-08', answers: { funciona: 'Rutina' }, scores: { fisica: 7, relaciones: 5 } });
    expect((await db.review.findFirstOrThrow({ where: { userId: alice, kind: 'weekly' } })).period).toBe('2026-10-05');
    await expect(saveReview(alice, { kind: 'weekly', period: '2026-10-08', answers: {}, scores: { fisica: 11 } })).rejects.toThrow();
    await expect(saveReview(alice, { kind: 'daily', period: '2026-10-08', answers: { inventada: 'x' } })).rejects.toThrow();
    await expect(saveReview(alice, { kind: 'monthly', period: '2026-10-08', answers: {} })).rejects.toThrow(/Mes/);
  });
  it('la prioridad de mañana pasa a tareas', async () => {
    const id = await priorityToTask(alice, 'Terminar el informe', '2026-10-09');
    expect(await db.task.findUniqueOrThrow({ where: { id } })).toMatchObject({ title: 'Terminar el informe', priority: 1 });
  });
});

describe('decisiones', () => {
  it('estructura con opciones; solo su dueño la edita', async () => {
    const id = await createDecision(alice, { title: '¿Cambio de trabajo?', objective: 'Más tiempo libre', options: [{ name: 'Quedarme', pros: 'Estabilidad' }, { name: 'Cambiar', risks: 'Periodo de prueba' }] });
    const row = await db.decision.findUniqueOrThrow({ where: { id } });
    expect((row.options as { name: string }[]).map((o) => o.name)).toEqual(['Quedarme', 'Cambiar']);
    await expect(updateDecision(bob, id, { title: 'Hackeada', options: [{ name: 'x' }] })).rejects.toThrow(/no encontrada/);
    await expect(createDecision(alice, { title: 'Sin opciones', options: [] })).rejects.toThrow(/al menos una opción/);
  });
});

describe('getCoachData', () => {
  it('panel, foco, tendencias y alertas a partir de los datos reales', async () => {
    await saveAnswers(alice, { answers: { o_prioridad: 'Salud' } });
    await createGoal(alice, goal());
    await createGoal(alice, goal({ title: 'Ahorrar 3000 €', area: 'finanzas', nextAction: null, metric: null }));
    await db.task.create({ data: { userId: alice, title: 'Llamar al seguro', priority: 1, status: 'next', dueDate: new Date('2026-10-08T12:00:00Z') } });
    for (const [p, f] of [['2026-09-21', 7], ['2026-09-28', 6], ['2026-10-05', 5]] as const) await saveReview(alice, { kind: 'weekly', period: p, answers: {}, scores: { fisica: f } });
    const c = await getCoachData(alice, NOW);
    expect(c.today).toBe('2026-10-08');
    expect(c.panel.goal).toMatchObject({ title: 'Correr 10 km en < 55 min' });
    expect(c.focus.important[0]).toMatchObject({ title: 'Llamar al seguro' });
    const ids = c.insights.map((i) => i.id);
    expect(ids).toEqual(expect.arrayContaining(['interview-continue', 'no-next-action', 'vague-goals', 'health-contradiction', 'declining-fisica']));
    expect(c.trends!.areas.find((a) => a.id === 'fisica')!.declining).toBe(true);
    // Bob no ve nada de Alice
    const b = await getCoachData(bob, NOW);
    expect(b.goals).toEqual([]);
    expect(b.reviews.weekly).toEqual([]);
  });
});

describe('asistente con el coach', () => {
  const ctx = (userId: string) => ({ userId, now: NOW, tzOffset: -120 });
  it('«¿cómo voy?» devuelve el dashboard personal con los datos del usuario', async () => {
    await createGoal(alice, goal());
    const t = await chat(ctx(alice), { text: '¿Cómo voy?' });
    expect(t.reply).toMatch(/🎯 OBJETIVOS/);
    expect(t.reply).toMatch(/Correr 10 km/);
    expect(t.reply).toMatch(/🚀 PRIORIDADES/);
  });
  it('«revisión semanal» con tendencias da las 4 conclusiones', async () => {
    for (const [p, f] of [['2026-09-21', 8], ['2026-09-28', 6], ['2026-10-05', 4]] as const) await saveReview(alice, { kind: 'weekly', period: p, answers: {}, scores: { fisica: f, trabajo: 8 } });
    const t = await chat(ctx(alice), { text: 'haz mi revisión semanal' });
    expect(t.reply).toMatch(/Lo que ha funcionado:.*Trabajo/);
    expect(t.reply).toMatch(/Lo que no ha funcionado:.*Salud física/);
    expect(t.reply).toMatch(/Tu prioridad de la próxima semana/);
  });
  it('«analiza mi decisión «…»» la estructura y señala huecos, sin ver las de otros', async () => {
    await createDecision(alice, { title: 'Cambio de coche', options: [{ name: 'Eléctrico', pros: 'Ahorro' }] });
    await createDecision(bob, { title: 'Cambio de coche de Bob', options: [{ name: 'Secreto' }] });
    const t = await chat(ctx(alice), { text: 'Analiza mi decisión «Cambio de coche» con el formato de decisiones' });
    expect(t.reply).toMatch(/DECISIÓN:\*\* Cambio de coche/);
    expect(t.reply).toMatch(/completa:.*desventajas de «Eléctrico»/);
    expect(t.reply).not.toMatch(/Secreto/);
  });
  it('create_goal es una propuesta: solo se crea al confirmar', async () => {
    const { createProposal } = await import('../ai/proposals');
    const p = await createProposal(ctx(alice), { tool: 'create_goal', args: { level: 'quarterly', area: 'finanzas', title: 'Fondo de emergencia de 6.000 €', metric: 'Saldo', target: '6000 €', dueDate: '2026-12-31', nextAction: 'Transferencia automática de 300 €' } });
    expect(await db.goal.count({ where: { userId: alice } })).toBe(0);
    expect(p.summary).toMatch(/Crear objetivo \(90 días\)/);
    await confirmProposal(alice, p.id, -120, NOW);
    expect(await db.goal.findFirstOrThrow({ where: { userId: alice } })).toMatchObject({ title: 'Fondo de emergencia de 6.000 €', level: 'quarterly' });
  });
});

describe('privacidad', () => {
  it('exportar → importar en otra cuenta conserva respuestas, objetivos (con jerarquía), revisiones y decisiones', async () => {
    await saveAnswers(alice, { answers: { h_sueno: '6 h', v_dia: 'Tranquilo' } });
    const annual = await createGoal(alice, goal({ level: 'annual', title: 'Maratón' }));
    await createGoal(alice, goal({ parentId: annual }));
    await saveReview(alice, { kind: 'weekly', period: '2026-10-05', answers: { funciona: 'Rutina' }, scores: { fisica: 7 } });
    await createDecision(alice, { title: 'Mudanza', options: [{ name: 'Sí' }, { name: 'No' }] });
    const file = JSON.stringify(await exportUserData(alice, NOW));
    const r = await importUserData(bob, file);
    expect(r.counts).toMatchObject({ 'respuestas del coach': 2, objetivos: 2, revisiones: 1, decisiones: 1 });
    const goals = await db.goal.findMany({ where: { userId: bob }, orderBy: { level: 'asc' } });
    const child = goals.find((g) => g.level === 'quarterly')!;
    expect(goals.find((g) => g.id === child.parentId)?.title).toBe('Maratón');
    // reimportar no duplica respuestas ni revisiones (mismo periodo), sí objetivos y decisiones (es «añadir»)
    const again = await importUserData(bob, file);
    expect(again.counts['respuestas del coach']).toBeUndefined();
    expect(again.counts.revisiones).toBeUndefined();
  });
});

describe('coach proactivo (planificador)', () => {
  it('el domingo sin revisión semanal avisa una sola vez; las alertas graves también', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'lifedash-coach-'));
    const prev = process.env.BACKUP_DIR;
    process.env.BACKUP_DIR = dir;
    try {
      await saveAnswers(alice, { answers: { h_sueno: '5 h' } });
      for (const day of ['2026-10-09', '2026-10-10', '2026-10-11']) await saveReview(alice, { kind: 'daily', period: day, answers: {}, mood: 3, energy: 4, stress: 5 });
      const sunday = new Date('2026-10-11T09:00:00Z');
      const r1 = await runScheduledTick(sunday);
      const r2 = await runScheduledTick(new Date('2026-10-11T18:00:00Z'));
      const n = await db.notification.findMany({ where: { userId: alice, type: 'coach' }, orderBy: { title: 'asc' } });
      expect(n.map((x) => x.title)).toEqual(['Toca tu revisión semanal', 'Tu ánimo lleva varios días bajo']);
      expect(r1.nudges).toBe(2);
      expect(r2.nudges).toBe(0);
      expect(await db.notification.count({ where: { userId: bob } })).toBe(0); // Bob no usa el coach
    } finally {
      await rm(dir, { recursive: true, force: true });
      if (prev === undefined) delete process.env.BACKUP_DIR; else process.env.BACKUP_DIR = prev;
    }
  });
});
