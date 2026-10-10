import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { createInvestment } from '../finance/investments';
import type { TextFetcher } from '../finance/quotes';
import { backupStatus, writeBackup } from './backup';
import { runScheduledTick } from './scheduled';

let alice: string, dir: string;
const prev = process.env.BACKUP_DIR;
const okMarket = (calls: string[] = []): TextFetcher => async (url) => {
  calls.push(url);
  return { text: JSON.stringify({ chart: { result: [{ meta: { regularMarketPrice: 123, currency: 'EUR' } }] } }) };
};
const down: TextFetcher = async () => { throw new Error('El servidor respondió 429'); };
const pos = { assetType: 'stock', symbol: 'SAN.MC', name: 'Santander', quantity: 1, avgCost: 100, currentPrice: 100, dividendYield: 0 };

beforeEach(async () => {
  await db.user.deleteMany();
  await db.jobRun.deleteMany();
  alice = (await db.user.create({ data: { email: 'Alice@Test.dev', name: 'alice', passwordHash: 'x', timezone: 'Europe/Madrid' } })).id;
  dir = await mkdtemp(path.join(os.tmpdir(), 'lifedash-bk-'));
  process.env.BACKUP_DIR = dir;
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
  if (prev === undefined) delete process.env.BACKUP_DIR; else process.env.BACKUP_DIR = prev;
});

describe('tareas diarias del planificador', () => {
  it('actualiza precios y hace copia una sola vez por día local', async () => {
    await createInvestment(alice, pos);
    const calls: string[] = [];
    const now = new Date('2026-10-05T08:00:00Z');
    const r1 = await runScheduledTick(now, { fetcher: okMarket(calls) });
    expect(r1).toMatchObject({ prices: 1, backups: 1, errors: 0 });
    expect(Number((await db.investment.findFirstOrThrow()).currentPrice)).toBe(123);
    const r2 = await runScheduledTick(new Date('2026-10-05T20:00:00Z'), { fetcher: okMarket(calls) });
    expect(r2).toMatchObject({ prices: 0, backups: 0 });
    expect(calls).toHaveLength(1);
    // 22:30 UTC del día 5 ya es día 6 en Madrid → nueva tarea diaria
    const r3 = await runScheduledTick(new Date('2026-10-05T22:30:00Z'), { fetcher: okMarket(calls) });
    expect(r3).toMatchObject({ prices: 1, backups: 1 });
  });
  it('sin conexión con el mercado no da el día por hecho y reintenta', async () => {
    await createInvestment(alice, pos);
    const now = new Date('2026-10-05T08:00:00Z');
    expect((await runScheduledTick(now, { fetcher: down })).prices).toBe(0);
    expect((await runScheduledTick(now, { fetcher: okMarket() })).prices).toBe(1);
  });
  it('sin inversiones no consulta el mercado', async () => {
    const calls: string[] = [];
    await runScheduledTick(new Date('2026-10-05T08:00:00Z'), { fetcher: okMarket(calls) });
    expect(calls).toEqual([]);
  });
  it('la copia es el JSON de exportación, en una carpeta por usuario', async () => {
    await createInvestment(alice, pos);
    await runScheduledTick(new Date('2026-10-05T08:00:00Z'), { fetcher: okMarket() });
    const st = await backupStatus('Alice@Test.dev');
    expect(st).toMatchObject({ enabled: true, count: 1, last: { name: 'life-dashboard-2026-10-05.json' } });
    const json = JSON.parse(await readFile(path.join(st.enabled ? st.dir : '', 'life-dashboard-2026-10-05.json'), 'utf8'));
    expect(json.portfolios[0].investments[0].symbol).toBe('SAN.MC');
    expect(path.basename(st.enabled ? st.dir : '')).toBe('alice_test.dev');
  });
  it('conserva solo las 14 copias más recientes y no toca otros ficheros', async () => {
    const user = { id: alice, email: 'alice@test.dev' };
    const folder = path.join(dir, 'alice_test.dev');
    await writeBackup(user, dir, '2026-01-01');
    await writeFile(path.join(folder, 'nota.txt'), 'mío');
    for (let d = 2; d <= 20; d++) await writeBackup(user, dir, `2026-01-${String(d).padStart(2, '0')}`);
    const files = (await readdir(folder)).sort();
    expect(files.filter((f) => f.endsWith('.json'))).toHaveLength(14);
    expect(files[0]).toBe('life-dashboard-2026-01-07.json');
    expect(files).toContain('nota.txt');
  });
  it('BACKUP_DIR=off desactiva las copias', async () => {
    process.env.BACKUP_DIR = 'off';
    expect((await runScheduledTick(new Date('2026-10-05T08:00:00Z'))).backups).toBe(0);
    expect(await backupStatus('alice@test.dev')).toEqual({ enabled: false });
  });
});
