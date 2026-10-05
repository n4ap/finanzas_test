'use server';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { calendarSchema, eventSchema, idSchema } from '@/lib/validation';
import { requireUser } from '../auth';
import { fail, firstIssue, type ActionResult } from './result';

const refresh = () => { revalidatePath('/calendar'); revalidatePath('/dashboard'); };

export async function createEvent(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const p = eventSchema.safeParse(input);
  if (!p.success) return fail(firstIssue(p.error));
  const d = p.data;
  if (!(await db.calendar.findFirst({ where: { id: d.calendarId, userId: user.id }, select: { id: true } }))) return fail('Calendario no válido');
  await db.event.create({ data: { ...d, startsAt: new Date(d.startsAt), endsAt: new Date(d.endsAt), attendees: d.attendees.filter(Boolean) } });
  refresh();
  return { ok: true };
}

export async function updateEvent(id: string, input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success) return fail('Evento no válido');
  const p = eventSchema.safeParse(input);
  if (!p.success) return fail(firstIssue(p.error));
  const d = p.data;
  const [event, cal] = await Promise.all([
    db.event.findFirst({ where: { id, calendar: { userId: user.id } }, select: { id: true } }),
    db.calendar.findFirst({ where: { id: d.calendarId, userId: user.id }, select: { id: true } }),
  ]);
  if (!event) return fail('Evento no encontrado');
  if (!cal) return fail('Calendario no válido');
  await db.event.update({ where: { id }, data: { ...d, startsAt: new Date(d.startsAt), endsAt: new Date(d.endsAt), attendees: d.attendees.filter(Boolean) } });
  refresh();
  return { ok: true };
}

export async function deleteEvent(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success) return fail('Evento no válido');
  const r = await db.event.deleteMany({ where: { id, calendar: { userId: user.id } } });
  if (r.count === 0) return fail('Evento no encontrado');
  refresh();
  return { ok: true };
}

export async function createCalendar(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const p = calendarSchema.safeParse(input);
  if (!p.success) return fail(firstIssue(p.error));
  await db.calendar.create({ data: { userId: user.id, ...p.data } });
  refresh();
  return { ok: true };
}

export async function deleteCalendar(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success) return fail('Calendario no válido');
  const cal = await db.calendar.findFirst({ where: { id, userId: user.id } });
  if (!cal) return fail('Calendario no encontrado');
  if (cal.isDefault) return fail('No se puede eliminar el calendario por defecto');
  await db.calendar.delete({ where: { id } });
  refresh();
  return { ok: true };
}
