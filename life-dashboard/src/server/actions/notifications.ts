'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireUser } from '../auth';

export async function markNotificationRead(id: string) {
  const user = await requireUser();
  const parsed = z.string().cuid().safeParse(id);
  if (!parsed.success) return;
  await db.notification.updateMany({ where: { id: parsed.data, userId: user.id }, data: { read: true } });
  revalidatePath('/', 'layout');
}

export async function markAllNotificationsRead() {
  const user = await requireUser();
  await db.notification.updateMany({ where: { userId: user.id, read: false }, data: { read: true } });
  revalidatePath('/', 'layout');
}
