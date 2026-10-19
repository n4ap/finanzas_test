'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { NEWS_CATEGORY_IDS } from '@/lib/news';
import { requireUser } from '../auth';
import { fail, type ActionResult } from './result';

const schema = z.array(z.enum(NEWS_CATEGORY_IDS)).max(NEWS_CATEGORY_IDS.length);

/** Guarda las categorías que el usuario quiere priorizar (dentro de User.preferences, sin pisar otras preferencias). */
export async function setFollowedCategories(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const p = schema.safeParse(input);
  if (!p.success) return fail('Categorías no válidas');
  const prefs = (user.preferences ?? {}) as Record<string, unknown>;
  await db.user.update({ where: { id: user.id }, data: { preferences: { ...prefs, followedNews: [...new Set(p.data)] } as Prisma.InputJsonValue } });
  revalidatePath('/news'); revalidatePath('/dashboard');
  return { ok: true };
}
