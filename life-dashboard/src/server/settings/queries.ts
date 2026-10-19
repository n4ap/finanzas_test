import 'server-only';
import { db } from '@/lib/db';
import { getAiSettings } from '../ai/provider-config';
import { listConnections } from '../integrations/service';
import { backupStatus } from '../jobs/backup';
import { listSessions } from './security';

export async function getSettingsData(userId: string, currentTokenHash: string) {
  const [u, connections, ai, sessions] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, email: true, city: true, timezone: true, preferences: true, createdAt: true } }),
    listConnections(userId),
    getAiSettings(userId),
    listSessions(userId, currentTokenHash),
  ]);
  const backups = await backupStatus(u.email);
  const prefs = (u.preferences ?? {}) as { followedNews?: string[] };
  return { profile: { name: u.name, email: u.email, city: u.city, timezone: u.timezone, followedNews: prefs.followedNews ?? [], since: u.createdAt.toISOString() }, connections, ai, sessions, backups };
}
export type SettingsData = Awaited<ReturnType<typeof getSettingsData>>;
