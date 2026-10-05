import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { decrypt } from '@/lib/crypto';
import { db } from '@/lib/db';
import { safeFetchText } from './safe-fetch';
import { addCalendarSubscription, addNewsFeed, LIMITS, listConnections, removeConnection, syncCalendar, syncDue, syncNewsFeed } from './service';

// Servidor de fixtures local. ALLOW_PRIVATE_FETCH solo se activa en los bloques que lo necesitan.
let server: http.Server, base: string;
let ics = '', feed = '';
const rssFeed = (...titles: string[]) => `<?xml version="1.0"?><rss version="2.0"><channel><title>Mi feed</title>${titles.map((t, i) => `<item><title>${t}</title><link>https://ejemplo.com/${encodeURIComponent(t)}</link><guid>g-${t}</guid><description>Resumen ${i}</description><pubDate>Mon, 05 Oct 2026 0${i}:00:00 GMT</pubDate></item>`).join('')}</channel></rss>`;
const vcal = (...evs: string[]) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${evs.map((e) => `BEGIN:VEVENT\r\n${e}\r\nEND:VEVENT`).join('\r\n')}\r\nEND:VCALENDAR`;
const soon = (days: number, h = 10) => { const d = new Date(Date.now() + days * 86_400_000); return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}T${String(h).padStart(2, '0')}0000Z`; };

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const u = req.url ?? '';
    if (u.startsWith('/cal.ics')) { res.setHeader('content-type', 'text/calendar'); return void res.end(ics); }
    if (u.startsWith('/feed.xml')) { res.setHeader('content-type', 'application/rss+xml'); return void res.end(feed); }
    if (u.startsWith('/redir')) { res.statusCode = 302; res.setHeader('location', '/feed.xml'); return void res.end(); }
    if (u.startsWith('/loop')) { res.statusCode = 302; res.setHeader('location', '/loop'); return void res.end(); }
    if (u.startsWith('/big')) return void res.end('x'.repeat(3_000_000));
    if (u.startsWith('/slow')) return; // nunca responde
    if (u.startsWith('/html')) return void res.end('<html>hola</html>');
    res.statusCode = 404; res.end('nope');
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => { server.closeAllConnections?.(); server.close(() => r()); }));

describe('safeFetchText: bloqueo SSRF (sin permiso para redes privadas)', () => {
  beforeEach(() => { delete process.env.ALLOW_PRIVATE_FETCH; });
  it.each([['/feed.xml', 'loopback'], ['/cal.ics', 'loopback']])('rechaza %s en 127.0.0.1 (%s) aunque el servidor responda', async (path) => {
    await expect(safeFetchText(`${base}${path}`)).rejects.toThrow(/no permitida/);
  });
  // IP literales: Node no consulta DNS, así que la comprobación debe saltar ANTES de abrir la conexión (no por fallo de red).
  it.each(['http://[::1]:1/x', 'http://169.254.169.254/latest/meta-data', 'http://10.0.0.5/x', 'http://192.168.1.1/x', 'http://0x7f.1/x', 'http://2130706433/x', 'http://[::ffff:127.0.0.1]/x', 'http://100.64.0.1/x'])('rechaza la IP literal %s', async (url) => {
    await expect(safeFetchText(url)).rejects.toThrow(/no permitida/);
  });
  it.each(['http://localhost:1/x', 'file:///etc/passwd', 'ftp://example.com/x', 'http://user:pw@example.com/x', 'http://mi-servidor.local/x'])('rechaza %s', async (url) => {
    await expect(safeFetchText(url)).rejects.toThrow();
  });
});

describe('safeFetchText: comportamiento (con permiso local de pruebas)', () => {
  beforeEach(() => { process.env.ALLOW_PRIVATE_FETCH = '1'; });
  afterAll(() => { delete process.env.ALLOW_PRIVATE_FETCH; });
  it('descarga, sigue redirecciones y limita tamaño, tiempo, errores y bucles', async () => {
    feed = rssFeed('A');
    expect((await safeFetchText(`${base}/feed.xml`)).text).toContain('<title>A</title>');
    expect((await safeFetchText(`${base}/redir`)).finalUrl).toBe(`${base}/feed.xml`);
    await expect(safeFetchText(`${base}/big`, { maxBytes: 1000 })).rejects.toThrow(/demasiado grande/);
    await expect(safeFetchText(`${base}/slow`, { timeoutMs: 300 })).rejects.toThrow(/Tiempo de espera/);
    await expect(safeFetchText(`${base}/nada`)).rejects.toThrow(/404/);
    await expect(safeFetchText(`${base}/loop`)).rejects.toThrow(/redirecciones/);
  });
});

describe('suscripciones', () => {
  let alice: string, bob: string;
  beforeEach(async () => {
    process.env.ALLOW_PRIVATE_FETCH = '1';
    await db.user.deleteMany();
    const mk = (n: string) => db.user.create({ data: { email: `${n}@test.dev`, name: n, passwordHash: 'x', timezone: 'Europe/Madrid' } }).then((u) => u.id);
    [alice, bob] = [await mk('alice'), await mk('bob')];
    ics = vcal(`UID:e1\r\nSUMMARY:Dentista\r\nDTSTART:${soon(2)}\r\nDTEND:${soon(2, 11)}`, `UID:e2\r\nSUMMARY:Cena\r\nDTSTART:${soon(3, 19)}\r\nDTEND:${soon(3, 21)}`);
    feed = rssFeed('Uno', 'Dos');
  });
  afterAll(() => { delete process.env.ALLOW_PRIVATE_FETCH; });

  it('calendario: suscribe, importa, guarda la URL CIFRADA y sincroniza cambios (alta, baja, edición)', async () => {
    const r = await addCalendarSubscription(alice, { name: 'Trabajo', url: `${base}/cal.ics` });
    expect(r.events).toBe(2);
    const acc = await db.account.findUniqueOrThrow({ where: { id: r.accountId } });
    expect(acc.accessTokenEnc).not.toContain('127.0.0.1');
    expect(decrypt(acc.accessTokenEnc!)).toBe(`${base}/cal.ics`);
    expect(await db.event.count({ where: { calendar: { userId: alice } } })).toBe(2);
    ics = vcal(`UID:e1\r\nSUMMARY:Dentista (cambiado)\r\nDTSTART:${soon(2)}\r\nDTEND:${soon(2, 11)}`, `UID:e3\r\nSUMMARY:Nuevo\r\nDTSTART:${soon(4)}\r\nDTEND:${soon(4, 11)}`);
    expect(await syncCalendar(alice, r.accountId)).toBe(2);
    const titles = (await db.event.findMany({ where: { calendar: { userId: alice } }, orderBy: { startsAt: 'asc' } })).map((e) => e.title);
    expect(titles).toEqual(['Dentista (cambiado)', 'Nuevo']); // e2 desapareció, e1 se actualizó, e3 llegó
    expect((await db.account.findUniqueOrThrow({ where: { id: r.accountId } })).status).toBe('connected');
  });
  it('rechaza lo que no es un calendario / no se puede alcanzar, y los duplicados', async () => {
    await expect(addCalendarSubscription(alice, { name: 'X', url: `${base}/html` })).rejects.toThrow(/iCal/);
    await expect(addCalendarSubscription(alice, { name: 'X', url: `${base}/nada` })).rejects.toThrow(/404/);
    await expect(addCalendarSubscription(alice, { name: '', url: `${base}/cal.ics` })).rejects.toThrow(/nombre/);
    await addCalendarSubscription(alice, { name: 'A', url: `${base}/cal.ics` });
    await expect(addCalendarSubscription(alice, { name: 'B', url: `${base}/cal.ics` })).rejects.toThrow(/Ya estás suscrito/);
    expect(await db.account.count()).toBe(1);
  });
  it('si el origen falla la conexión pasa a error (con el motivo) y los eventos se conservan', async () => {
    const r = await addCalendarSubscription(alice, { name: 'Trabajo', url: `${base}/cal.ics` });
    ics = 'ya no soy un calendario';
    await expect(syncCalendar(alice, r.accountId)).rejects.toThrow(/ya no devuelve/);
    const acc = await db.account.findUniqueOrThrow({ where: { id: r.accountId } });
    expect(acc).toMatchObject({ status: 'error' });
    expect(acc.lastError).toMatch(/ya no devuelve/);
    expect(await db.event.count({ where: { calendar: { userId: alice } } })).toBe(2);
  });
  it('feed: importa sin duplicar al volver a sincronizar y añade solo lo nuevo', async () => {
    const r = await addNewsFeed(alice, { url: `${base}/feed.xml`, category: 'tecnologia' });
    expect(r.articles).toBe(2);
    expect(await syncNewsFeed(alice, r.accountId)).toBe(0);
    feed = rssFeed('Uno', 'Dos', 'Tres');
    expect(await syncNewsFeed(alice, r.accountId)).toBe(1);
    const arts = await db.newsArticle.findMany({ where: { userId: alice } });
    expect(arts).toHaveLength(3);
    expect(arts.every((a) => a.category === 'tecnologia' && a.source === 'Mi feed' && a.accountId === r.accountId)).toBe(true);
    expect((await db.account.findUniqueOrThrow({ where: { id: r.accountId } })).label).toBe('Mi feed');
  });
  it('feed: rechaza lo que no es feed, URLs peligrosas y categorías inválidas', async () => {
    await expect(addNewsFeed(alice, { url: `${base}/html`, category: 'ia' })).rejects.toThrow(/feed RSS/);
    await expect(addNewsFeed(alice, { url: 'file:///etc/passwd', category: 'ia' })).rejects.toThrow();
    await expect(addNewsFeed(alice, { url: `${base}/feed.xml`, category: 'cualquiera' })).rejects.toThrow();
  });
  it('aislamiento: otro usuario no puede sincronizar ni borrar mis conexiones', async () => {
    const r = await addCalendarSubscription(alice, { name: 'Trabajo', url: `${base}/cal.ics` });
    await expect(syncCalendar(bob, r.accountId)).rejects.toThrow(/no encontrada/);
    await expect(removeConnection(bob, r.accountId)).rejects.toThrow(/no encontrada/);
    expect(await listConnections(bob)).toEqual([]);
    expect((await listConnections(alice))[0]).toMatchObject({ kind: 'calendar', label: 'Trabajo', status: 'connected' });
  });
  it('desconectar borra el calendario con sus eventos / los artículos del feed', async () => {
    const c = await addCalendarSubscription(alice, { name: 'Trabajo', url: `${base}/cal.ics` });
    const f = await addNewsFeed(alice, { url: `${base}/feed.xml`, category: 'ia' });
    await removeConnection(alice, c.accountId);
    await removeConnection(alice, f.accountId);
    expect(await db.calendar.count({ where: { userId: alice } })).toBe(0);
    expect(await db.event.count()).toBe(0);
    expect(await db.newsArticle.count()).toBe(0);
    expect(await db.account.count()).toBe(0);
  });
  it('límites por usuario y sincronización periódica aislando fallos', async () => {
    for (let i = 0; i < LIMITS.feeds; i++) await addNewsFeed(alice, { url: `${base}/feed.xml?n=${i}`, category: 'ia' });
    await expect(addNewsFeed(alice, { url: `${base}/feed.xml?n=99`, category: 'ia' })).rejects.toThrow(/Máximo/);
    await db.account.updateMany({ data: { lastSyncAt: new Date(0) } });
    const first = await db.account.findFirstOrThrow();
    await db.account.update({ where: { id: first.id }, data: { accessTokenEnc: 'basura' } }); // una conexión corrupta no tumba a las demás
    const r = await syncDue(new Date(), 3_600_000, 50);
    expect(r.ok + r.failed).toBe(LIMITS.feeds);
    expect(r.failed).toBe(1);
  });
});
