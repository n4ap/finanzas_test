'use server';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/crypto';
import { rateLimit } from '@/lib/rate-limit';
import { loginSchema, registerSchema } from '@/lib/validation';
import { authenticate, createSession, destroySession } from '../auth';

/** Se devuelven email/nombre (nunca la contraseña) para repoblar el formulario tras un error. */
// Intentos de login por minuto y email+IP. Solo se sobreescribe en pruebas e2e.
const LOGIN_LIMIT = Number(process.env.LOGIN_RATE_LIMIT ?? 5);

export interface FormState { error?: string; email?: string; name?: string }

async function clientKey(scope: string, extra: string) {
  const h = await headers();
  return `${scope}:${h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local'}:${extra}`;
}

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get('email') ?? '');
  const parsed = loginSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos no válidos', email };
  const rl = rateLimit(await clientKey('login', parsed.data.email), LOGIN_LIMIT, 60_000);
  if (!rl.ok) return { error: `Demasiados intentos. Espera ${Math.ceil(rl.retryAfterMs / 1000)} s.`, email };
  const user = await authenticate(parsed.data.email, parsed.data.password);
  if (!user) return { error: 'Email o contraseña incorrectos', email };
  await createSession(user.id);
  redirect('/dashboard');
}

export async function registerAction(_: FormState, form: FormData): Promise<FormState> {
  const keep = { email: String(form.get('email') ?? ''), name: String(form.get('name') ?? '') };
  const parsed = registerSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Datos no válidos', ...keep };
  const rl = rateLimit(await clientKey('register', 'any'), 5, 600_000);
  if (!rl.ok) return { error: 'Demasiados registros desde esta conexión. Inténtalo más tarde.', ...keep };
  if (await db.user.findUnique({ where: { email: parsed.data.email } })) return { error: 'No se pudo crear la cuenta con esos datos', ...keep };
  const user = await db.user.create({
    data: {
      email: parsed.data.email,
      name: parsed.data.name,
      passwordHash: await hashPassword(parsed.data.password),
      calendars: { create: { name: 'Personal', isDefault: true } },
      bankAccounts: { create: { name: 'Cuenta principal' } },
      portfolios: { create: { name: 'Cartera principal' } },
    },
  });
  await createSession(user.id);
  redirect('/dashboard');
}

export async function logoutAction() {
  await destroySession();
  redirect('/login');
}
