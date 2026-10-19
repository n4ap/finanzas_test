import 'server-only';
import { mkdir, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { exportUserData } from '../settings/privacy';

export const BACKUP_KEEP = 14;
const FILE_RE = /^life-dashboard-\d{4}-\d{2}-\d{2}\.json$/;

/** Carpeta de copias: BACKUP_DIR (o «backups» junto al proyecto). BACKUP_DIR=off las desactiva. */
export function backupRoot(): string | null {
  const v = process.env.BACKUP_DIR?.trim();
  if (v && v.toLowerCase() === 'off') return null;
  return path.resolve(v || path.join(process.cwd(), 'backups'));
}

const folderFor = (root: string, email: string) => path.join(root, email.toLowerCase().replace(/[^a-z0-9._-]/g, '_'));

/** Escribe la copia del día (mismo formato que «Exportar») y deja solo las `keep` más recientes. */
export async function writeBackup(user: { id: string; email: string }, root: string, day: string, keep = BACKUP_KEEP) {
  const dir = folderFor(root, user.email);
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `life-dashboard-${day}.json`);
  const tmp = `${file}.tmp`;
  await writeFile(tmp, JSON.stringify(await exportUserData(user.id), null, 2), { encoding: 'utf8', mode: 0o600 });
  await rename(tmp, file); // atómico: nunca queda una copia a medias con el nombre definitivo
  const old = (await readdir(dir)).filter((f) => FILE_RE.test(f)).sort().reverse().slice(keep);
  await Promise.all(old.map((f) => unlink(path.join(dir, f))));
  return file;
}

export async function backupStatus(email: string) {
  const root = backupRoot();
  if (!root) return { enabled: false as const };
  const dir = folderFor(root, email);
  const files = await readdir(dir).then((l) => l.filter((f) => FILE_RE.test(f)).sort(), () => [] as string[]);
  const last = files.at(-1);
  return { enabled: true as const, dir, count: files.length, last: last ? { name: last, at: (await stat(path.join(dir, last))).mtime.toISOString() } : null };
}
