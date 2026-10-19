import type { ZodError } from 'zod';

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

export const fail = (error: string): ActionResult<never> => ({ ok: false, error });
export const firstIssue = (e: ZodError) => e.issues[0]?.message ?? 'Datos no válidos';
