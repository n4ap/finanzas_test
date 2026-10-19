import 'server-only';
import { revalidatePath } from 'next/cache';
import { rateLimit } from '@/lib/rate-limit';
import { requireUser } from '../auth';
import { run } from '../finance/service';
import { fail, type ActionResult } from './result';

/** Ejecuta un servicio con el usuario autenticado (sesión validada), limita el ritmo de escrituras y refresca las vistas. */
export async function exec<T>(fn: (userId: string) => Promise<T>, paths: string[]): Promise<ActionResult<T>> {
  const user = await requireUser();
  if (!rateLimit(`mut:${user.id}`, 120, 60_000).ok) return fail('Demasiadas operaciones seguidas. Inténtalo en un momento.');
  const r = await run(() => fn(user.id));
  if (!r.ok) return r;
  for (const p of paths) revalidatePath(p);
  return { ok: true, data: r.data };
}
