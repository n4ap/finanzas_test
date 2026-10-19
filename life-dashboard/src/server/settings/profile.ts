import 'server-only';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { NEWS_CATEGORY_IDS } from '@/lib/news';
import { fail, issue } from '../life/core';

export const isValidTimezone = (tz: string) => { try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; } };

const profileSchema = z.object({
  name: z.string().trim().min(1, 'Introduce tu nombre').max(80),
  city: z.string().trim().min(1, 'Introduce tu ciudad').max(80),
  timezone: z.string().refine(isValidTimezone, 'Zona horaria no válida'),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  followedNews: z.array(z.enum(NEWS_CATEGORY_IDS)).max(10).default([]),
});

export async function updateProfile(userId: string, input: unknown) {
  const p = profileSchema.safeParse(input);
  if (!p.success) return fail(issue(p.error));
  const u = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { preferences: true } });
  const prefs = (u.preferences ?? {}) as Record<string, unknown>;
  await db.user.update({ where: { id: userId }, data: { name: p.data.name, city: p.data.city, timezone: p.data.timezone, ...(p.data.theme ? { theme: p.data.theme } : {}), preferences: { ...prefs, followedNews: p.data.followedNews } as Prisma.InputJsonValue } });
}

/** Desfase (minutos, como Date.getTimezoneOffset) de una zona IANA en un instante: para tareas del servidor sin navegador (cron). */
export function tzOffsetMinutes(tz: string, at = new Date()): number {
  if (!isValidTimezone(tz)) return 0;
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
  const p = Object.fromEntries(f.formatToParts(at).map((x) => [x.type, Number(x.value)])) as Record<string, number>;
  return Math.round((Math.floor(at.getTime() / 60_000) * 60_000 - Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!)) / 60_000);
}
