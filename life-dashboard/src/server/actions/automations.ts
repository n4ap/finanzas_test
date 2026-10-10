'use server';
import { clampOffset } from '@/lib/tz';
import { runAutomations, previewAutomation, type RunReport } from '../automations/engine';
import { createAutomation, deleteAutomation, setAutomationEnabled, updateAutomation } from '../automations/service';
import { requireUser } from '../auth';
import { run } from '../finance/service';
import { exec } from './exec';
import { fail, type ActionResult } from './result';
import { idSchema } from '@/lib/validation';
import { rateLimit } from '@/lib/rate-limit';
import { revalidatePath } from 'next/cache';

const PATHS = ['/automations', '/dashboard', '/assistant', '/tasks'];
export async function createAutomationAction(input: unknown) { return exec((u) => createAutomation(u, input), PATHS); }
export async function updateAutomationAction(id: string, input: unknown) { return exec((u) => updateAutomation(u, id, input), PATHS); }
export async function setAutomationEnabledAction(id: string, enabled: boolean) { return exec((u) => setAutomationEnabled(u, id, enabled), PATHS); }
export async function deleteAutomationAction(id: string) { return exec((u) => deleteAutomation(u, id), PATHS); }

export async function runAutomationsAction(id: string | null, tzOffset?: number): Promise<ActionResult<RunReport[]>> {
  const user = await requireUser();
  if (id && !idSchema.safeParse(id).success) return fail('Automatización no válida');
  if (!rateLimit(`autorun:${user.id}`, 10, 60_000).ok) return fail('Demasiadas ejecuciones seguidas. Espera un momento.');
  const r = await run(() => runAutomations({ userId: user.id, now: new Date(), tzOffset: clampOffset(tzOffset) }, id ?? undefined));
  if (r.ok) for (const p of [...PATHS, '/']) revalidatePath(p, p === '/' ? 'layout' : undefined);
  return r.ok ? { ok: true, data: r.data } : r;
}

export async function previewAutomationAction(id: string, tzOffset?: number): Promise<ActionResult<Awaited<ReturnType<typeof previewAutomation>>>> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success) return fail('Automatización no válida');
  const r = await run(() => previewAutomation({ userId: user.id, now: new Date(), tzOffset: clampOffset(tzOffset) }, id));
  return r.ok ? { ok: true, data: r.data } : r;
}
