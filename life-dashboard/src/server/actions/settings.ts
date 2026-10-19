'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sha256 } from '@/lib/crypto';
import { rateLimit } from '@/lib/rate-limit';
import { idSchema } from '@/lib/validation';
import { removeAiKey, saveAiSettings } from '../ai/provider-config';
import { SESSION_COOKIE, destroySession, requireUser } from '../auth';
import { run } from '../finance/service';
import { addCalendarSubscription, addNewsFeed, removeConnection, syncCalendar, syncNewsFeed } from '../integrations/service';
import { deleteAccount, deleteUserData } from '../settings/privacy';
import { updateProfile } from '../settings/profile';
import { changePassword, revokeOtherSessions, revokeSession } from '../settings/security';
import { exec } from './exec';
import { fail, type ActionResult } from './result';

const tokenHash = async () => sha256((await cookies()).get(SESSION_COOKIE)?.value ?? '');
const limited = (key: string, max: number, windowMs: number, userId: string) => rateLimit(`${key}:${userId}`, max, windowMs).ok;

// ── Perfil y preferencias
export async function updateProfileAction(input: unknown) { return exec((u) => updateProfile(u, input), ['/settings', '/dashboard', '/news']); }

// ── Seguridad
export async function changePasswordAction(input: { current: string; next: string }): Promise<ActionResult<{ revoked: number }>> {
  const user = await requireUser();
  if (!limited('pw', 5, 10 * 60_000, user.id)) return fail('Demasiados intentos. Espera unos minutos.');
  const r = await run(async () => changePassword(user.id, await tokenHash(), { current: String(input?.current ?? ''), next: String(input?.next ?? '') }));
  return r.ok ? { ok: true, data: r.data } : r;
}
export async function revokeSessionAction(id: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success) return fail('Sesión no válida');
  const r = await run(async () => revokeSession(user.id, id, await tokenHash()));
  if (r.ok) revalidatePath('/settings');
  return r.ok ? { ok: true } : r;
}
export async function revokeOtherSessionsAction(): Promise<ActionResult<number>> {
  const user = await requireUser();
  const n = await revokeOtherSessions(user.id, await tokenHash());
  revalidatePath('/settings');
  return { ok: true, data: n };
}

// ── Privacidad (acciones destructivas: contraseña obligatoria y límite de intentos)
export async function deleteDataAction(password: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!limited('del', 5, 10 * 60_000, user.id)) return fail('Demasiados intentos. Espera unos minutos.');
  const r = await run(() => deleteUserData(user.id, String(password ?? '')));
  if (r.ok) revalidatePath('/', 'layout');
  return r.ok ? { ok: true } : r;
}
export async function deleteAccountAction(password: string, email: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!limited('del', 5, 10 * 60_000, user.id)) return fail('Demasiados intentos. Espera unos minutos.');
  const r = await run(() => deleteAccount(user.id, String(password ?? ''), String(email ?? '')));
  if (!r.ok) return r;
  await destroySession(); // borra la cookie (la sesión de BD ya no existe)
  redirect('/login');
}

// ── IA
export async function saveAiSettingsAction(input: unknown) {
  const user = await requireUser();
  if (!limited('aikey', 10, 10 * 60_000, user.id)) return fail('Demasiados intentos. Espera unos minutos.');
  const r = await run(() => saveAiSettings(user.id, input));
  if (r.ok) for (const p of ['/settings', '/assistant']) revalidatePath(p);
  return r.ok ? ({ ok: true } as ActionResult) : r;
}
export async function removeAiKeyAction() { return exec((u) => removeAiKey(u), ['/settings', '/assistant']); }

// ── Conexiones (iCal / RSS)
const CONNECT_PATHS = ['/settings', '/calendar', '/news', '/dashboard'];
export async function addCalendarAction(input: unknown) { return limitedExec('conn', input, (u) => addCalendarSubscription(u, input)); }
export async function addFeedAction(input: unknown) { return limitedExec('conn', input, (u) => addNewsFeed(u, input)); }
export async function syncConnectionAction(id: string, kind: 'calendar' | 'news') {
  const user = await requireUser();
  if (!idSchema.safeParse(id).success) return fail('Conexión no válida');
  if (!limited('sync', 12, 60_000, user.id)) return fail('Demasiadas sincronizaciones seguidas. Espera un momento.');
  const r = await run(() => (kind === 'calendar' ? syncCalendar(user.id, id) : syncNewsFeed(user.id, id)));
  for (const p of CONNECT_PATHS) revalidatePath(p);
  return r.ok ? ({ ok: true, data: r.data } as ActionResult<number>) : r;
}
export async function removeConnectionAction(id: string) { return exec((u) => removeConnection(u, id), CONNECT_PATHS); }

async function limitedExec<T>(key: string, _input: unknown, fn: (userId: string) => Promise<T>) {
  const user = await requireUser();
  if (!limited(key, 10, 60_000, user.id)) return fail('Demasiadas operaciones seguidas. Espera un momento.');
  return exec(fn, CONNECT_PATHS);
}
