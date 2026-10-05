import 'server-only';
import { db } from '@/lib/db';
import { familySchema, labelSchema } from '@/lib/validation-life';
import { LIMITS, fail, issue, toNoon } from './core';

const data = (m: ReturnType<typeof familySchema.parse>) => ({ name: m.name, relation: m.relation, birthday: m.birthday ? toNoon(m.birthday) : null, color: m.color, notes: m.notes ?? null });

export async function createMember(userId: string, input: unknown) {
  const p = familySchema.safeParse(input);
  if (!p.success) return fail(issue(p.error));
  if ((await db.familyMember.count({ where: { userId } })) >= LIMITS.family) return fail('Has alcanzado el máximo de personas');
  return (await db.familyMember.create({ data: { userId, ...data(p.data) } })).id;
}

export async function updateMember(userId: string, id: string, input: unknown) {
  const p = familySchema.safeParse(input);
  if (!p.success) return fail(issue(p.error));
  const r = await db.familyMember.updateMany({ where: { id, userId }, data: data(p.data) });
  if (r.count === 0) fail('Persona no encontrada');
}

export async function deleteMember(userId: string, id: string) {
  const r = await db.familyMember.deleteMany({ where: { id, userId } });
  if (r.count === 0) fail('Persona no encontrada');
}

export async function addShopping(userId: string, input: unknown) {
  const p = labelSchema.safeParse(input);
  if (!p.success) return fail(issue(p.error));
  if ((await db.shoppingItem.count({ where: { userId } })) >= LIMITS.shopping) return fail('La lista es demasiado larga');
  return (await db.shoppingItem.create({ data: { userId, label: p.data.label } })).id;
}

export async function setShoppingDone(userId: string, id: string, done: boolean) {
  const r = await db.shoppingItem.updateMany({ where: { id, userId }, data: { done } });
  if (r.count === 0) fail('Elemento no encontrado');
}

export async function deleteShopping(userId: string, id: string) {
  const r = await db.shoppingItem.deleteMany({ where: { id, userId } });
  if (r.count === 0) fail('Elemento no encontrado');
}

export async function clearDoneShopping(userId: string) {
  return (await db.shoppingItem.deleteMany({ where: { userId, done: true } })).count;
}
