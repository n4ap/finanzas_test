'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { idSchema } from '@/lib/validation';
import { requireUser } from '../auth';
import { analyzeEmail, draftReply, extractTasks } from '../email-ai';
import { fail, type ActionResult } from './result';

const refresh = () => { revalidatePath('/email'); revalidatePath('/dashboard'); };

const flagSchema = z.enum(['read', 'starred', 'important', 'replied']);

/** Cambia un indicador del email (leído, destacado, importante, respondido). */
export async function setEmailFlag(id: string, flag: z.infer<typeof flagSchema>, value: boolean): Promise<ActionResult> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success || !flagSchema.safeParse(flag).success) return fail('Datos no válidos');
  const r = await db.email.updateMany({ where: { id, userId: user.id }, data: { [flag]: value } });
  if (r.count === 0) return fail('Email no encontrado');
  refresh();
  return { ok: true };
}

/** Analiza un email (resumen, categoría, respuesta requerida, fecha límite) y guarda el resultado. Acción iniciada por el usuario. */
export async function analyzeEmailAction(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success) return fail('Email no válido');
  const e = await db.email.findFirst({ where: { id, userId: user.id } });
  if (!e) return fail('Email no encontrado');
  const a = analyzeEmail(e, new Date());
  await db.email.update({ where: { id }, data: { summary: a.summary, category: a.category, needsReply: e.folder === 'sent' ? false : a.needsReply, deadline: a.deadline } });
  refresh();
  return { ok: true };
}

export async function analyzeAllEmails(): Promise<ActionResult<{ count: number }>> {
  const user = await requireUser();
  const pending = await db.email.findMany({ where: { userId: user.id, folder: 'inbox', summary: null }, take: 50 });
  const now = new Date();
  await db.$transaction(pending.map((e) => {
    const a = analyzeEmail(e, now);
    return db.email.update({ where: { id: e.id }, data: { summary: a.summary, category: a.category, needsReply: a.needsReply, deadline: a.deadline } });
  }));
  refresh();
  return { ok: true, data: { count: pending.length } };
}

/** Sugerencias de tareas extraídas del email (no crea nada: el usuario decide cuáles añadir). */
export async function suggestTasksFromEmail(id: string): Promise<ActionResult<{ title: string; dueDate: string | null }[]>> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success) return fail('Email no válido');
  const e = await db.email.findFirst({ where: { id, userId: user.id } });
  if (!e) return fail('Email no encontrado');
  return { ok: true, data: extractTasks(e, new Date()).map((t) => ({ title: t.title, dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null })) };
}

const newTaskSchema = z.object({ title: z.string().trim().min(1).max(200), dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable() });

export async function createTaskFromEmail(id: string, input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const p = newTaskSchema.safeParse(input);
  if (!idSchema.safeParse(id).success || !p.success) return fail('Datos no válidos');
  const e = await db.email.findFirst({ where: { id, userId: user.id }, select: { subject: true, fromName: true } });
  if (!e) return fail('Email no encontrado');
  await db.task.create({
    data: { userId: user.id, title: p.data.title, description: `Desde el email «${e.subject}» de ${e.fromName}`, status: 'next', priority: 2, dueDate: p.data.dueDate ? new Date(`${p.data.dueDate}T12:00:00.000Z`) : null, tags: ['email'] },
  });
  revalidatePath('/tasks'); revalidatePath('/dashboard');
  return { ok: true };
}

/** Genera un borrador de respuesta. Solo devuelve texto: la app no envía correos. */
export async function generateReplyDraft(id: string): Promise<ActionResult<{ to: string; subject: string; body: string }>> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success) return fail('Email no válido');
  const e = await db.email.findFirst({ where: { id, userId: user.id } });
  if (!e) return fail('Email no encontrado');
  return { ok: true, data: { to: e.fromEmail, ...draftReply(e, user.name.split(' ')[0] ?? user.name, new Date()) } };
}
