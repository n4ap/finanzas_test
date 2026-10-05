import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { createMember, addShopping, clearDoneShopping, deleteMember, setShoppingDone, updateMember } from './family';
import { completeWorkout, createWorkout, deleteMetric, deleteWorkout, saveMetric, setGoal, updateWorkout } from './health';
import { createProject, deleteProject, updateProject } from './projects';
import { addBooking, addDefaultPacking, addItineraryItem, addPackingItem, createTrip, deleteBooking, deleteItineraryItem, deleteTrip, setPacked, updateBooking, updateItineraryItem, updateTrip } from './travel';

// Integración contra PostgreSQL real: cada usuario solo toca lo suyo.
let alice: string, bob: string;
const trip = (o: Record<string, unknown> = {}) => ({ name: 'Lisboa', destination: 'Lisboa', startDate: '2026-10-27', endDate: '2026-10-30', budget: 900, ...o });

beforeEach(async () => {
  await db.user.deleteMany();
  const mk = (n: string) => db.user.create({ data: { email: `${n}@test.dev`, name: n, passwordHash: 'x' } }).then((u) => u.id);
  [alice, bob] = [await mk('alice'), await mk('bob')];
});

describe('proyectos', () => {
  it('CRUD propio; otro usuario no puede editar ni borrar', async () => {
    const id = await createProject(alice, { name: 'Reforma', status: 'active', targetDate: '2026-12-01' });
    await expect(updateProject(bob, id, { name: 'Robado' })).rejects.toThrow(/no encontrado/);
    await expect(deleteProject(bob, id)).rejects.toThrow(/no encontrado/);
    await updateProject(alice, id, { name: 'Reforma 2', status: 'paused' });
    expect(await db.project.findUnique({ where: { id } })).toMatchObject({ name: 'Reforma 2', status: 'paused' });
  });
  it('borrar un proyecto conserva sus tareas', async () => {
    const id = await createProject(alice, { name: 'P' });
    const t = await db.task.create({ data: { userId: alice, title: 'T', projectId: id } });
    await deleteProject(alice, id);
    expect((await db.task.findUnique({ where: { id: t.id } }))?.projectId).toBeNull();
  });
  it('valida entrada', async () => {
    await expect(createProject(alice, { name: '' })).rejects.toThrow(/obligatorio/);
    await expect(createProject(alice, { name: 'x', status: 'raro' })).rejects.toThrow();
  });
});

describe('salud', () => {
  it('una medición por tipo y día: guardar de nuevo la sustituye', async () => {
    await saveMetric(alice, { kind: 'weight', date: '2026-10-07', value: 80 });
    await saveMetric(alice, { kind: 'weight', date: '2026-10-07', value: 79.4 });
    await saveMetric(alice, { kind: 'steps', date: '2026-10-07', value: 9000 });
    const rows = await db.healthMetric.findMany({ where: { userId: alice }, orderBy: { kind: 'asc' } });
    expect(rows.map((r) => [r.kind, r.value])).toEqual([['steps', 9000], ['weight', 79.4]]);
  });
  it('rechaza valores fuera de rango y no deja borrar mediciones ajenas', async () => {
    await expect(saveMetric(alice, { kind: 'sleep', date: '2026-10-07', value: 40 })).rejects.toThrow(/fuera de rango/);
    await saveMetric(alice, { kind: 'weight', date: '2026-10-07', value: 80 });
    const m = await db.healthMetric.findFirstOrThrow();
    await expect(deleteMetric(bob, m.id)).rejects.toThrow();
    expect(await db.healthMetric.count()).toBe(1);
  });
  it('entrenos: completar planificado, aislamiento y metas', async () => {
    const id = await createWorkout(alice, { kind: 'gym', title: 'Pierna', date: '2026-10-08T18:00:00Z', minutes: 60, planned: true });
    await expect(completeWorkout(bob, id)).rejects.toThrow();
    await expect(updateWorkout(bob, id, { kind: 'gym', title: 'x', date: '2026-10-08T18:00:00Z', minutes: 5 })).rejects.toThrow();
    await expect(deleteWorkout(bob, id)).rejects.toThrow();
    await completeWorkout(alice, id);
    expect((await db.workout.findUniqueOrThrow({ where: { id } })).planned).toBe(false);
    await expect(completeWorkout(alice, id)).rejects.toThrow(); // ya no está planificado
    await setGoal(alice, { kind: 'steps', target: 10000 });
    await setGoal(alice, { kind: 'steps', target: 11000 });
    expect((await db.healthGoal.findMany({ where: { userId: alice } })).map((g) => g.target)).toEqual([11000]);
    await expect(setGoal(alice, { kind: 'sleep', target: 20 })).rejects.toThrow(/entre/);
  });
});

describe('viajes', () => {
  it('otro usuario no puede añadir ni tocar nada del viaje', async () => {
    const id = await createTrip(alice, trip());
    const b = await addBooking(alice, id, { kind: 'flight', title: 'Vuelo', cost: 190 });
    const it = await addItineraryItem(alice, id, { date: '2026-10-28', title: 'Belém' });
    const p = await addPackingItem(alice, id, { label: 'Pasaporte' });
    await expect(addBooking(bob, id, { kind: 'flight', title: 'x' })).rejects.toThrow(/no encontrado/);
    await expect(addItineraryItem(bob, id, { date: '2026-10-28', title: 'x' })).rejects.toThrow();
    await expect(addPackingItem(bob, id, { label: 'x' })).rejects.toThrow();
    await expect(addDefaultPacking(bob, id)).rejects.toThrow();
    await expect(updateBooking(bob, b, { kind: 'flight', title: 'x' })).rejects.toThrow();
    await expect(deleteBooking(bob, b)).rejects.toThrow();
    await expect(updateItineraryItem(bob, it, { date: '2026-10-28', title: 'x' })).rejects.toThrow();
    await expect(deleteItineraryItem(bob, it)).rejects.toThrow();
    await expect(setPacked(bob, p, true)).rejects.toThrow();
    await expect(updateTrip(bob, id, trip())).rejects.toThrow();
    await expect(deleteTrip(bob, id)).rejects.toThrow();
    expect(await db.travel.count()).toBe(1);
    expect(await db.packingItem.findUniqueOrThrow({ where: { id: p } })).toMatchObject({ packed: false });
  });
  it('el itinerario debe caer dentro de las fechas del viaje', async () => {
    const id = await createTrip(alice, trip());
    await expect(addItineraryItem(alice, id, { date: '2026-11-15', title: 'Fuera' })).rejects.toThrow(/dentro del viaje/);
    const it = await addItineraryItem(alice, id, { date: '2026-10-30', title: 'Regreso', time: '18:00' });
    await expect(updateItineraryItem(alice, it, { date: '2026-10-31', title: 'Regreso' })).rejects.toThrow(/dentro del viaje/);
  });
  it('acortar el viaje no deja planes huérfanos', async () => {
    const id = await createTrip(alice, trip());
    await addItineraryItem(alice, id, { date: '2026-10-30', title: 'Regreso' });
    await expect(updateTrip(alice, id, trip({ endDate: '2026-10-28' }))).rejects.toThrow(/fuera de las nuevas fechas/);
    await updateTrip(alice, id, trip({ endDate: '2026-11-02', name: 'Lisboa+' }));
    expect((await db.trip.findUniqueOrThrow({ where: { id } })).name).toBe('Lisboa+');
  });
  it('maleta por defecto no duplica y borrar el viaje borra todo lo suyo', async () => {
    const id = await createTrip(alice, trip());
    const first = await addDefaultPacking(alice, id);
    expect(first).toBeGreaterThan(0);
    expect(await addDefaultPacking(alice, id)).toBe(0);
    await addBooking(alice, id, { kind: 'hotel', title: 'H' });
    await addItineraryItem(alice, id, { date: '2026-10-27', title: 'X' });
    await deleteTrip(alice, id);
    expect(await db.packingItem.count() + await db.travel.count() + await db.itineraryItem.count()).toBe(0);
  });
  it('valida fechas y reservas', async () => {
    await expect(createTrip(alice, trip({ endDate: '2026-10-01' }))).rejects.toThrow(/anterior/);
    const id = await createTrip(alice, trip());
    await expect(addBooking(alice, id, { kind: 'hotel', title: 'H', startsAt: '2026-10-30T10:00:00Z', endsAt: '2026-10-27T10:00:00Z' })).rejects.toThrow(/anterior/);
    await expect(addBooking(alice, id, { kind: 'cohete', title: 'H' })).rejects.toThrow();
  });
});

describe('familia', () => {
  it('personas y lista de la compra aisladas por usuario', async () => {
    const id = await createMember(alice, { name: 'Mamá', relation: 'Madre', birthday: '1960-03-10', color: '#10b981' });
    await expect(updateMember(bob, id, { name: 'x', relation: 'y' })).rejects.toThrow();
    await expect(deleteMember(bob, id)).rejects.toThrow();
    await updateMember(alice, id, { name: 'Mamá', relation: 'Madre', birthday: '', notes: 'Le gustan las flores' });
    expect(await db.familyMember.findUniqueOrThrow({ where: { id } })).toMatchObject({ birthday: null, notes: 'Le gustan las flores' });
    const a = await addShopping(alice, { label: 'Leche' });
    await addShopping(alice, { label: 'Pan' });
    await expect(setShoppingDone(bob, a, true)).rejects.toThrow();
    await setShoppingDone(alice, a, true);
    expect(await clearDoneShopping(bob)).toBe(0);
    expect(await clearDoneShopping(alice)).toBe(1);
    expect(await db.shoppingItem.count()).toBe(1);
  });
});
