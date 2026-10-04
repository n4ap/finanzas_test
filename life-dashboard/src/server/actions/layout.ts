'use server';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { layoutSchema } from '@/lib/validation';
import { mergeLayout } from '@/lib/widgets';
import { requireUser } from '../auth';

/** Guarda la configuración del dashboard del usuario (validada y normalizada). */
export async function saveDashboardLayout(input: unknown): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const parsed = layoutSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const widgets = mergeLayout(parsed.data) as unknown as Prisma.InputJsonValue;
  await db.dashboardLayout.upsert({ where: { userId: user.id }, update: { widgets }, create: { userId: user.id, widgets } });
  return { ok: true };
}

export async function resetDashboardLayout(): Promise<{ ok: boolean }> {
  const user = await requireUser();
  await db.dashboardLayout.deleteMany({ where: { userId: user.id } });
  return { ok: true };
}
