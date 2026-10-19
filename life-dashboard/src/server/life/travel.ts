import 'server-only';
import { db } from '@/lib/db';
import { DEFAULT_PACKING, tripDayKeys } from '@/lib/travel';
import { bookingSchema, itinerarySchema, labelSchema, tripSchema } from '@/lib/validation-life';
import { LIMITS, fail, issue, toNoon } from './core';

async function ownedTrip(userId: string, tripId: string) {
  return (await db.trip.findFirst({ where: { id: tripId, userId } })) ?? fail('Viaje no encontrado');
}

const tripData = (t: ReturnType<typeof tripSchema.parse>) => ({
  name: t.name, destination: t.destination, startDate: toNoon(t.startDate), endDate: toNoon(t.endDate), budget: t.budget ?? null, notes: t.notes ?? null,
});

export async function createTrip(userId: string, input: unknown) {
  const p = tripSchema.safeParse(input);
  if (!p.success) return fail(issue(p.error));
  if ((await db.trip.count({ where: { userId } })) >= LIMITS.trips) return fail('Has alcanzado el máximo de viajes');
  return (await db.trip.create({ data: { userId, ...tripData(p.data) } })).id;
}

export async function updateTrip(userId: string, id: string, input: unknown) {
  const p = tripSchema.safeParse(input);
  if (!p.success) return fail(issue(p.error));
  await ownedTrip(userId, id);
  // Acortar el viaje no debe dejar planes huérfanos e invisibles: se pide moverlos o borrarlos antes.
  const outside = await db.itineraryItem.count({ where: { tripId: id, OR: [{ date: { lt: toNoon(p.data.startDate) } }, { date: { gt: toNoon(p.data.endDate) } }] } });
  if (outside > 0) return fail(`Hay ${outside} elementos del itinerario fuera de las nuevas fechas. Muévelos o elimínalos antes.`);
  await db.trip.update({ where: { id }, data: tripData(p.data) });
}

export async function deleteTrip(userId: string, id: string) {
  const r = await db.trip.deleteMany({ where: { id, userId } });
  if (r.count === 0) fail('Viaje no encontrado');
}

// ── Reservas
const bookingData = (b: ReturnType<typeof bookingSchema.parse>) => ({
  kind: b.kind, title: b.title, reference: b.reference ?? null, startsAt: b.startsAt ? new Date(b.startsAt) : null, endsAt: b.endsAt ? new Date(b.endsAt) : null, cost: b.cost ?? null, details: b.details ?? null,
});

export async function addBooking(userId: string, tripId: string, input: unknown) {
  const p = bookingSchema.safeParse(input);
  if (!p.success) return fail(issue(p.error));
  await ownedTrip(userId, tripId);
  if ((await db.travel.count({ where: { tripId } })) >= LIMITS.bookings) return fail('Demasiadas reservas en este viaje');
  return (await db.travel.create({ data: { tripId, ...bookingData(p.data) } })).id;
}

export async function updateBooking(userId: string, id: string, input: unknown) {
  const p = bookingSchema.safeParse(input);
  if (!p.success) return fail(issue(p.error));
  const r = await db.travel.updateMany({ where: { id, trip: { userId } }, data: bookingData(p.data) });
  if (r.count === 0) fail('Reserva no encontrada');
}

export async function deleteBooking(userId: string, id: string) {
  const r = await db.travel.deleteMany({ where: { id, trip: { userId } } });
  if (r.count === 0) fail('Reserva no encontrada');
}

// ── Itinerario
export async function addItineraryItem(userId: string, tripId: string, input: unknown) {
  const p = itinerarySchema.safeParse(input);
  if (!p.success) return fail(issue(p.error));
  const trip = await ownedTrip(userId, tripId);
  if (!tripDayKeys(trip.startDate, trip.endDate).includes(p.data.date)) return fail('La fecha debe estar dentro del viaje');
  if ((await db.itineraryItem.count({ where: { tripId } })) >= LIMITS.itinerary) return fail('Demasiados elementos en el itinerario');
  return (await db.itineraryItem.create({ data: { tripId, date: toNoon(p.data.date), time: p.data.time ?? null, title: p.data.title, notes: p.data.notes ?? null } })).id;
}

export async function updateItineraryItem(userId: string, id: string, input: unknown) {
  const p = itinerarySchema.safeParse(input);
  if (!p.success) return fail(issue(p.error));
  const item = (await db.itineraryItem.findFirst({ where: { id, trip: { userId } }, include: { trip: true } })) ?? fail('Elemento no encontrado');
  if (!tripDayKeys(item.trip.startDate, item.trip.endDate).includes(p.data.date)) return fail('La fecha debe estar dentro del viaje');
  await db.itineraryItem.update({ where: { id }, data: { date: toNoon(p.data.date), time: p.data.time ?? null, title: p.data.title, notes: p.data.notes ?? null } });
}

export async function deleteItineraryItem(userId: string, id: string) {
  const r = await db.itineraryItem.deleteMany({ where: { id, trip: { userId } } });
  if (r.count === 0) fail('Elemento no encontrado');
}

// ── Maleta
export async function addPackingItem(userId: string, tripId: string, input: unknown) {
  const p = labelSchema.safeParse(input);
  if (!p.success) return fail(issue(p.error));
  await ownedTrip(userId, tripId);
  if ((await db.packingItem.count({ where: { tripId } })) >= LIMITS.packing) return fail('Maleta demasiado grande');
  return (await db.packingItem.create({ data: { tripId, label: p.data.label } })).id;
}

export async function addDefaultPacking(userId: string, tripId: string) {
  await ownedTrip(userId, tripId);
  const existing = new Set((await db.packingItem.findMany({ where: { tripId }, select: { label: true } })).map((i) => i.label));
  const missing = DEFAULT_PACKING.filter((l) => !existing.has(l));
  if (missing.length) await db.packingItem.createMany({ data: missing.map((label) => ({ tripId, label })) });
  return missing.length;
}

export async function setPacked(userId: string, id: string, packed: boolean) {
  const r = await db.packingItem.updateMany({ where: { id, trip: { userId } }, data: { packed } });
  if (r.count === 0) fail('Elemento no encontrado');
}

export async function deletePackingItem(userId: string, id: string) {
  const r = await db.packingItem.deleteMany({ where: { id, trip: { userId } } });
  if (r.count === 0) fail('Elemento no encontrado');
}
