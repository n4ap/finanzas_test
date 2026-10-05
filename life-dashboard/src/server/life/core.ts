import 'server-only';
import type { ZodError } from 'zod';
import { ServiceError } from '../finance/core';

export { ServiceError };
export const fail = (message: string): never => { throw new ServiceError(message); };
export const issue = (e: ZodError) => e.issues[0]?.message ?? 'Datos no válidos';
export const toNoon = (s: string) => new Date(`${s}T12:00:00.000Z`);
export const num = (d: { toString(): string } | null | undefined) => (d == null ? null : Number(d.toString()));

/** Límites por usuario/viaje: evitan que un bucle o un cliente malicioso llene la BD. */
export const LIMITS = { projects: 100, trips: 100, bookings: 60, itinerary: 300, packing: 200, family: 100, shopping: 300, workouts: 5000 } as const;
