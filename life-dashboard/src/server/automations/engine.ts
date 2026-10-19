import 'server-only';
import { db } from '@/lib/db';
import { describeAutomation, type TriggerType } from '@/lib/automations';
import { triggerConfigSchemas } from '@/lib/automation-schema';
import { addDaysKey, localKey, weekdayOf } from '@/lib/tz';
import type { AIContext } from '../providers/types';
import { getDashboardData } from '../dashboard-data';
import { createProposal } from '../ai/proposals';
import { toolByName } from '../ai/tools';
import { ServiceError } from '../life/core';

export interface Match { key: string; subject: string; title: string; body: string; href: string }
const MAX_MATCHES = 20;
const wk = (key: string) => { const d = new Date(`${key}T12:00:00Z`); const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7)); const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return `${t.getUTCFullYear()}-W${String(Math.ceil(((t.getTime() - y0.getTime()) / 86_400_000 + 1) / 7)).padStart(2, '0')}`; };
/** Ejecuta una herramienta de lectura (los resultados se tipan en cada uso). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const run = (name: string, ctx: AIContext, args: unknown) => toolByName(name)!.run(ctx, toolByName(name)!.schema.parse(args)) as Promise<any>;

/** Coincidencias actuales de un disparador para ese usuario (solo lectura, acotado por userId). */
export async function findMatches(ctx: AIContext, triggerType: TriggerType, rawConfig: unknown): Promise<Match[]> {
  const cfg = triggerConfigSchemas[triggerType].parse(rawConfig ?? {}) as Record<string, number>;
  const today = localKey(ctx.now, ctx.tzOffset);
  switch (triggerType) {
    case 'task_overdue': {
      const rows = await db.task.findMany({ where: { userId: ctx.userId, status: { not: 'done' }, parentId: null, dueDate: { lt: new Date(`${today}T00:00:00Z`) } }, orderBy: { dueDate: 'asc' }, take: MAX_MATCHES });
      return rows.map((t) => ({ key: `task:${t.id}`, subject: t.title, title: `Tarea atrasada: ${t.title}`, body: `Venció el ${t.dueDate!.toISOString().slice(0, 10).split('-').reverse().join('/')}`, href: '/tasks' }));
    }
    case 'budget_alert': {
      const d = await run('get_spending', ctx, {});
      return (d.budgetAlerts as { category: string; spent: number; budget: number; pct: number; status: string }[]).filter((b) => b.pct * 100 >= cfg.threshold!).slice(0, MAX_MATCHES)
        .map((b) => ({ key: `budget:${b.category}:${d.month}:${cfg.threshold}`, subject: `presupuesto de ${b.category}`, title: b.status === 'over' ? `Presupuesto de ${b.category} superado` : `Presupuesto de ${b.category} al ${Math.round(b.pct * 100)} %`, body: `${Math.round(b.spent)} € de ${Math.round(b.budget)} € este mes`, href: '/finance?tab=presupuestos' }));
    }
    case 'birthday_soon': {
      const d = await run('get_birthdays', ctx, { days: cfg.days });
      return (d.birthdays as { id: string; name: string; daysUntil: number; turning: number }[]).slice(0, MAX_MATCHES).map((b) => ({
        key: `bday:${b.id}:${addDaysKey(today, b.daysUntil).slice(0, 4)}`, subject: b.name, title: `Cumpleaños de ${b.name}`, body: `${b.daysUntil === 0 ? 'Hoy' : b.daysUntil === 1 ? 'Mañana' : `En ${b.daysUntil} días`} cumple ${b.turning}`, href: '/family',
      }));
    }
    case 'email_needs_reply': {
      const limit = new Date(`${addDaysKey(today, cfg.days!)}T23:59:59Z`);
      const rows = await db.email.findMany({ where: { userId: ctx.userId, folder: 'inbox', needsReply: true, replied: false, deadline: { not: null, lte: limit } }, orderBy: { deadline: 'asc' }, take: MAX_MATCHES });
      return rows.map((e) => ({ key: `email:${e.id}`, subject: e.subject, title: `Responder a ${e.fromName}`, body: `${e.subject.slice(0, 100)} · límite ${e.deadline!.toISOString().slice(0, 10).split('-').reverse().join('/')}`, href: '/email' }));
    }
    case 'trip_soon': {
      const d = await run('get_trips', ctx, {});
      return (d.trips as { id: string; name: string; daysUntil: number; packingPending: number; phase: string }[]).filter((t) => t.phase === 'upcoming' && t.daysUntil <= cfg.days! && t.packingPending > 0)
        .map((t) => ({ key: `trip:${t.id}`, subject: t.name, title: `Prepara la maleta de ${t.name}`, body: `Sales en ${t.daysUntil} días y te faltan ${t.packingPending} cosas`, href: `/travel/${t.id}` }));
    }
    case 'weekly': {
      const iso = weekdayOf(today) || 7;
      return iso === cfg.weekday ? [{ key: `week:${wk(today)}`, subject: 'resumen semanal', title: 'Tu resumen semanal', body: '', href: '/dashboard' }] : [];
    }
  }
}

export interface RunReport { automationId: string; name: string; matched: number; fired: number; proposals: number; errors: string[] }

/**
 * Ejecuta las automatizaciones activas del usuario. Idempotente: cada (automatización, clave) dispara UNA vez
 * (restricción única en BD), así que ejecutarlo varias veces o en paralelo no duplica avisos ni tareas.
 * Las acciones que crean datos pasan por una propuesta que el usuario confirma, salvo que haya desactivado esa confirmación.
 */
export async function runAutomations(ctx: AIContext, only?: string): Promise<RunReport[]> {
  const autos = await db.automation.findMany({ where: { userId: ctx.userId, enabled: true, ...(only ? { id: only } : {}) }, orderBy: { createdAt: 'asc' } });
  const reports: RunReport[] = [];
  for (const a of autos) {
    const report: RunReport = { automationId: a.id, name: a.name, matched: 0, fired: 0, proposals: 0, errors: [] };
    reports.push(report);
    let matches: Match[];
    try { matches = await findMatches(ctx, a.triggerType as TriggerType, a.triggerConfig); } catch (e) { report.errors.push(e instanceof ServiceError ? e.message : 'No se pudo evaluar la regla'); continue; }
    report.matched = matches.length;
    const fresh = matches.length ? await db.automationRun.createManyAndReturn({ data: matches.map((m) => ({ automationId: a.id, key: m.key })), skipDuplicates: true }) : [];
    const firedKeys = new Set(fresh.map((f) => f.key));
    for (const m of matches.filter((m) => firedKeys.has(m.key))) {
      try {
        if (a.actionType === 'notify') await db.notification.create({ data: { userId: ctx.userId, type: 'automation', title: m.title, body: m.body || null, href: m.href } });
        else if (a.actionType === 'digest') {
          const d = await getDashboardData(ctx.userId, ctx.now);
          const top = d.priorities.slice(0, 3).map((p) => `${p.title} (${p.detail})`).join(' · ');
          await db.notification.create({ data: { userId: ctx.userId, type: 'automation', title: a.name, body: [d.nextAction.message, top && `Prioridades: ${top}`].filter(Boolean).join(' — ').slice(0, 500), href: '/dashboard' } });
        } else if (a.actionType === 'create_task') {
          const title = String((a.actionConfig as { titleTemplate?: string }).titleTemplate ?? 'Revisar: {subject}').replaceAll('{subject}', m.subject).slice(0, 200);
          if (a.requiresConfirmation) {
            const p = await createProposal(ctx, { tool: 'create_task', args: { title }, source: 'automation' });
            await db.notification.create({ data: { userId: ctx.userId, type: 'automation', title: `Propuesta pendiente: ${p.summary}`, body: `Generada por «${a.name}». Confírmala o descártala.`, href: '/automations' } });
            report.proposals++;
          } else {
            await db.task.create({ data: { userId: ctx.userId, title, status: 'next', priority: 2, tags: ['automatización'] } });
          }
        }
        report.fired++;
      } catch (e) {
        // La clave ya está registrada: no se reintenta en bucle; se informa del fallo.
        report.errors.push(e instanceof ServiceError ? e.message : 'Fallo al ejecutar la acción');
        if (!(e instanceof ServiceError)) console.error('[automations]', a.id, e);
      }
    }
    await db.automation.update({ where: { id: a.id }, data: { lastRunAt: ctx.now } });
  }
  return reports;
}

/** Vista previa SIN efectos: qué dispararía la regla ahora y qué ya se disparó antes. */
export async function previewAutomation(ctx: AIContext, id: string) {
  const a = await db.automation.findFirst({ where: { id, userId: ctx.userId } });
  if (!a) throw new ServiceError('Automatización no encontrada');
  const matches = await findMatches(ctx, a.triggerType as TriggerType, a.triggerConfig);
  const done = new Set((await db.automationRun.findMany({ where: { automationId: id, key: { in: matches.map((m) => m.key) } }, select: { key: true } })).map((r) => r.key));
  return { description: describeAutomation(a), matches: matches.map((m) => ({ title: m.title, body: m.body, alreadyFired: done.has(m.key) })) };
}

