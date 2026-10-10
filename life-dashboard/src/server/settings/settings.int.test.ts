import { beforeEach, describe, expect, it } from 'vitest';
import { hashPassword, sha256, verifyPassword } from '@/lib/crypto';
import { db } from '@/lib/db';
import { exportSchema } from '@/lib/privacy-format';
import { deleteAccount, deleteUserData, exportUserData, importUserData } from './privacy';
import { isValidTimezone, tzOffsetMinutes, updateProfile } from './profile';
import { changePassword, listSessions, revokeOtherSessions, revokeSession } from './security';

const PW = 'contraseña-larga-123';
let alice: string, bob: string;
const mk = async (n: string) => (await db.user.create({ data: { email: `${n}@test.dev`, name: n, passwordHash: await hashPassword(PW) } })).id;
const noon = (d: string) => new Date(`${d}T12:00:00Z`);

/** Fixture rica: toca todos los modelos exportables. */
async function seedRich(userId: string) {
  const p = await db.project.create({ data: { userId, name: 'Reforma', status: 'active', priority: 1, color: '#6366f1', targetDate: noon('2026-12-01') } });
  const t = await db.task.create({ data: { userId, projectId: p.id, title: 'Pedir presupuesto', status: 'next', priority: 1, dueDate: noon('2026-10-09'), tags: ['casa'], recurrence: 'weekly' } });
  await db.task.create({ data: { userId, projectId: p.id, parentId: t.id, title: 'Llamar al fontanero', status: 'inbox', priority: 2 } });
  const cal = await db.calendar.create({ data: { userId, name: 'Personal', color: '#10b981', isDefault: true } });
  await db.event.create({ data: { calendarId: cal.id, title: 'Dentista', startsAt: new Date('2026-10-06T08:00:00Z'), endsAt: new Date('2026-10-06T09:00:00Z'), attendees: ['ana@x.dev'], important: true } });
  await db.email.create({ data: { userId, folder: 'inbox', fromName: 'Ana', fromEmail: 'ana@x.dev', subject: 'Contrato', body: 'Texto', snippet: 'Texto', receivedAt: new Date('2026-10-04T10:00:00Z'), needsReply: true, deadline: noon('2026-10-08') } });
  const acc = await db.bankAccount.create({ data: { ownerId: userId, name: 'Corriente', kind: 'checking', openingBalance: '1234.56' } });
  await db.transaction.createMany({ data: [{ userId, accountId: acc.id, date: noon('2026-10-01'), amount: '-25.50', category: 'ocio', description: 'Cena' }, { userId, accountId: acc.id, date: noon('2026-10-02'), amount: '2650.00', category: 'ingresos', description: 'Nómina', recurring: true }] });
  await db.budget.create({ data: { userId, category: 'ocio', monthly: '200.00' } });
  const port = await db.portfolio.create({ data: { userId, name: 'Principal' } });
  const inv = await db.investment.create({ data: { portfolioId: port.id, assetType: 'etf', symbol: 'VWCE', name: 'Vanguard', quantity: '12.12345678', avgCost: '100.1234', currentPrice: '110.5', dividendYield: '1.250' } });
  await db.dividend.create({ data: { investmentId: inv.id, date: noon('2026-09-15'), amount: '12.34' } });
  await db.portfolioSnapshot.create({ data: { portfolioId: port.id, date: noon('2026-10-01'), value: '1340.00', cost: '1213.50' } });
  await db.workout.create({ data: { userId, kind: 'gym', title: 'Pierna', date: new Date('2026-10-03T18:00:00Z'), minutes: 60, calories: 400 } });
  await db.healthMetric.create({ data: { userId, kind: 'weight', date: noon('2026-10-04'), value: 78.4 } });
  await db.healthGoal.create({ data: { userId, kind: 'steps', target: 9000 } });
  const trip = await db.trip.create({ data: { userId, name: 'Lisboa', destination: 'Lisboa', startDate: noon('2026-11-01'), endDate: noon('2026-11-04'), budget: '900.00' } });
  await db.travel.create({ data: { tripId: trip.id, kind: 'flight', title: 'Vuelo', reference: 'XK29', cost: '190.00' } });
  await db.itineraryItem.create({ data: { tripId: trip.id, date: noon('2026-11-02'), time: '09:30', title: 'Belém' } });
  await db.packingItem.create({ data: { tripId: trip.id, label: 'Pasaporte', packed: true } });
  await db.familyMember.create({ data: { userId, name: 'Mamá', relation: 'Madre', birthday: noon('1962-10-11'), color: '#10b981', notes: 'Flores' } });
  await db.shoppingItem.create({ data: { userId, label: 'Leche', done: true } });
  await db.automation.create({ data: { userId, name: 'Atrasadas', triggerType: 'task_overdue', actionType: 'notify', enabled: true } });
  const conv = await db.aIConversation.create({ data: { userId, title: 'Hola' } });
  await db.aIMessage.createMany({ data: [{ conversationId: conv.id, role: 'user', content: 'hola' }, { conversationId: conv.id, role: 'tool', content: '{"x":1}' }, { conversationId: conv.id, role: 'assistant', content: 'buenas' }] });
  await db.auditLog.create({ data: { userId, entity: 'Transaction', entityId: 'x', action: 'create' } });
  // Datos que NO deben salir en la exportación:
  await db.account.create({ data: { userId, provider: 'anthropic', kind: 'ai', externalId: 'default', accessTokenEnc: 'SECRETO-CIFRADO' } });
  await db.session.create({ data: { userId, tokenHash: sha256(`s-${userId}`), expiresAt: new Date(Date.now() + 1e9) } });
}

// Los ids (ref/projectRef/parentRef) cambian al importar: las relaciones se comprueban aparte.
const strip = (o: unknown): unknown => JSON.parse(JSON.stringify(o, (k, v) => (['ref', 'projectRef', 'parentRef', 'exportedAt', 'profile', 'auditLog'].includes(k) ? undefined : v)));

beforeEach(async () => {
  await db.user.deleteMany();
  await db.household.deleteMany();
  [alice, bob] = [await mk('alice'), await mk('bob')];
});

describe('exportar', () => {
  it('incluye todo lo propio, cumple el esquema y NO contiene contraseñas, sesiones ni claves', async () => {
    await seedRich(alice);
    await seedRich(bob);
    const out = await exportUserData(alice);
    expect(exportSchema.safeParse(out).success).toBe(true);
    const text = JSON.stringify(out);
    for (const secret of ['SECRETO-CIFRADO', 'passwordHash', 'tokenHash', 'scrypt']) expect(text).not.toContain(secret);
    expect(text).not.toContain(bob); // nada del otro usuario
    expect(out.projects).toHaveLength(1);
    expect(out.tasks).toHaveLength(2);
    expect(out.conversations![0]!.messages!.map((m) => m.role)).toEqual(['user', 'assistant']); // sin mensajes de herramienta
    expect(out.bankAccounts![0]!.transactions).toHaveLength(2);
    expect(out.auditLog).toHaveLength(1);
  });
  it('los calendarios suscritos no se exportan (se resincronizan) y las cuentas ajenas compartidas tampoco', async () => {
    const acct = await db.account.create({ data: { userId: alice, provider: 'ics', kind: 'calendar', externalId: 'x', accessTokenEnc: 'u' } });
    await db.calendar.create({ data: { userId: alice, accountId: acct.id, name: 'Suscrito' } });
    await db.calendar.create({ data: { userId: alice, name: 'Mío' } });
    const hh = await db.household.create({ data: { name: 'H', members: { create: [{ userId: alice, role: 'owner' }, { userId: bob }] } } });
    await db.bankAccount.create({ data: { ownerId: bob, householdId: hh.id, name: 'De Bob compartida', openingBalance: 0 } });
    const out = await exportUserData(alice);
    expect(out.calendars!.map((c) => c.name)).toEqual(['Mío']);
    expect(out.bankAccounts).toEqual([]);
  });
});

describe('importar', () => {
  it('ida y vuelta: lo exportado por Alice entra en Bob idéntico (ids nuevos, relaciones y decimales intactos)', async () => {
    await seedRich(alice);
    const exported = await exportUserData(alice);
    const r = await importUserData(bob, JSON.stringify(exported));
    expect(r.total).toBeGreaterThan(15);
    expect(r.counts).toMatchObject({ proyectos: 1, tareas: 2, eventos: 1, emails: 1, movimientos: 2, viajes: 1, familia: 1 });
    const back = await exportUserData(bob);
    const a = strip(exported) as Record<string, unknown>, b = strip(back) as Record<string, unknown>;
    // Las automatizaciones llegan desactivadas por seguridad; el resto es idéntico.
    (a.automations as { enabled: boolean }[]).forEach((x) => (x.enabled = false));
    expect(b).toEqual(a);
    // Ids nuevos y propiedad correcta
    expect(await db.task.count({ where: { userId: bob } })).toBe(2);
    const sub = await db.task.findFirstOrThrow({ where: { userId: bob, title: 'Llamar al fontanero' }, include: { parent: true, project: true } });
    expect(sub.parent!.title).toBe('Pedir presupuesto');
    expect(sub.project!.userId).toBe(bob);
    const tx = await db.transaction.findFirstOrThrow({ where: { userId: bob, description: 'Nómina' } });
    expect(tx.amount.toString()).toBe('2650');
    expect((await db.investment.findFirstOrThrow({ where: { portfolio: { userId: bob } } })).quantity.toString()).toBe('12.12345678');
    expect((await db.automation.findFirstOrThrow({ where: { userId: bob } })).enabled).toBe(false);
    expect(await db.task.count({ where: { userId: alice } })).toBe(2); // Alice intacta
  });
  it('importar dos veces AÑADE (no pisa) y respeta presupuestos y metas ya existentes', async () => {
    await seedRich(alice);
    await db.budget.create({ data: { userId: bob, category: 'ocio', monthly: '999.00' } });
    const file = JSON.stringify(await exportUserData(alice));
    await importUserData(bob, file);
    await importUserData(bob, file);
    expect(await db.task.count({ where: { userId: bob } })).toBe(4);
    expect((await db.budget.findFirstOrThrow({ where: { userId: bob, category: 'ocio' } })).monthly.toString()).toBe('999');
  });
  it('rechaza archivos inválidos sin importar nada', async () => {
    await seedRich(alice);
    const good = await exportUserData(alice);
    const cases: [string, string, RegExp][] = [
      ['no es JSON', '{no', /JSON válido/], ['otra app', JSON.stringify({ app: 'otra', version: 1 }), /no es una exportación de Life Dashboard/], ['versión futura', JSON.stringify({ ...good, version: 2 }), /Archivo no válido/],
      ['enum inválido', JSON.stringify({ ...good, tasks: [{ ...good.tasks![0], status: 'hackeado' }] }), /Archivo no válido/], ['fecha inválida', JSON.stringify({ ...good, workouts: [{ ...good.workouts![0], date: 'ayer' }] }), /Archivo no válido/],
      ['importe inválido', JSON.stringify({ ...good, budgets: [{ category: 'x', monthly: '1e9; DROP TABLE' }] }), /Archivo no válido/], ['color inválido', JSON.stringify({ ...good, projects: [{ ...good.projects![0], color: 'rojo' }] }), /Archivo no válido/],
      ['demasiado grande', 'x'.repeat(15_000_001), /demasiado grande/],
    ];
    for (const [name, raw, re] of cases) await expect(importUserData(bob, raw), name).rejects.toThrow(re);
    expect(await db.project.count({ where: { userId: bob } })).toBe(0);
  });
  it('es atómico: si la base de datos rechaza un dato al final, no queda nada a medias', async () => {
    await seedRich(alice);
    const good = await exportUserData(alice);
    // El carácter NUL pasa el esquema pero PostgreSQL lo rechaza al escribir (última sección importada).
    const boom = { ...good, conversations: [{ title: 'x', createdAt: new Date().toISOString(), messages: [{ role: 'user' as const, content: 'a\u0000b', createdAt: new Date().toISOString() }] }] };
    await expect(importUserData(bob, JSON.stringify(boom))).rejects.toThrow(/No se ha importado nada/);
    for (const n of [await db.project.count({ where: { userId: bob } }), await db.task.count({ where: { userId: bob } }), await db.bankAccount.count({ where: { ownerId: bob } }), await db.transaction.count({ where: { userId: bob } }), await db.trip.count({ where: { userId: bob } }), await db.aIConversation.count({ where: { userId: bob } })]) expect(n).toBe(0);
  });
  it('datos con aspecto malicioso se guardan como texto inerte', async () => {
    const evil = { app: 'life-dashboard', version: 1, exportedAt: new Date().toISOString(), tasks: [{ ref: 'a', title: '<script>alert(1)</script>', priority: 2, status: 'next', tags: [] }], shopping: [{ label: "'; DROP TABLE \"User\"; --" }] };
    await importUserData(bob, JSON.stringify(evil));
    expect((await db.task.findFirstOrThrow({ where: { userId: bob } })).title).toBe('<script>alert(1)</script>');
    expect(await db.user.count()).toBe(2);
  });
});

describe('eliminar datos y cuenta', () => {
  it('borrar datos exige la contraseña, conserva la cuenta y no toca a otros', async () => {
    await seedRich(alice); await seedRich(bob);
    await expect(deleteUserData(alice, 'incorrecta')).rejects.toThrow(/contraseña/);
    expect(await db.task.count({ where: { userId: alice } })).toBe(2);
    await deleteUserData(alice, PW);
    expect(await db.user.findUnique({ where: { id: alice } })).not.toBeNull();
    expect(await db.session.count({ where: { userId: alice } })).toBe(1); // la sesión se conserva
    for (const n of [await db.task.count({ where: { userId: alice } }), await db.bankAccount.count({ where: { ownerId: alice } }), await db.transaction.count({ where: { userId: alice } }), await db.event.count({ where: { calendar: { userId: alice } } }), await db.trip.count({ where: { userId: alice } }), await db.account.count({ where: { userId: alice } }), await db.aIMessage.count({ where: { conversation: { userId: alice } } }), await db.auditLog.count({ where: { userId: alice } })]) expect(n).toBe(0);
    expect(await db.task.count({ where: { userId: bob } })).toBe(2); // Bob intacto
    expect(await db.transaction.count({ where: { userId: bob } })).toBe(2);
  });
  it('eliminar cuenta exige contraseña y escribir el email; borra el usuario y todo', async () => {
    await seedRich(alice);
    await expect(deleteAccount(alice, PW, 'otro@test.dev')).rejects.toThrow(/email/);
    await expect(deleteAccount(alice, 'mal', 'alice@test.dev')).rejects.toThrow(/contraseña/);
    expect(await db.user.count()).toBe(2);
    await deleteAccount(alice, PW, ' ALICE@test.dev ');
    expect(await db.user.findUnique({ where: { id: alice } })).toBeNull();
    expect(await db.session.count({ where: { userId: alice } })).toBe(0);
    expect(await db.task.count()).toBe(0);
    expect(await db.user.count()).toBe(1);
  });
  it('cuenta compartida: al eliminar al propietario, la otra persona conserva la cuenta y TODOS los movimientos', async () => {
    const hh = await db.household.create({ data: { name: 'H', members: { create: [{ userId: alice, role: 'owner' }, { userId: bob }] } } });
    const acc = await db.bankAccount.create({ data: { ownerId: alice, householdId: hh.id, name: 'Compartida', openingBalance: 100 } });
    await db.transaction.createMany({ data: [{ userId: alice, accountId: acc.id, date: noon('2026-10-01'), amount: -10, category: 'ocio', description: 'De Alice' }, { userId: bob, accountId: acc.id, date: noon('2026-10-02'), amount: -20, category: 'ocio', description: 'De Bob' }] });
    await deleteAccount(alice, PW, 'alice@test.dev');
    const kept = await db.bankAccount.findUniqueOrThrow({ where: { id: acc.id }, include: { transactions: true, household: { include: { members: true } } } });
    expect(kept.ownerId).toBe(bob);
    expect(kept.transactions.map((t) => [t.description, t.userId]).sort()).toEqual([['De Alice', bob], ['De Bob', bob]]);
    expect(kept.household!.members).toEqual([expect.objectContaining({ userId: bob, role: 'owner' })]);
  });
  it('cuenta compartida: al eliminar al miembro, lo que aportó queda en la cuenta del propietario', async () => {
    const hh = await db.household.create({ data: { name: 'H', members: { create: [{ userId: alice, role: 'owner' }, { userId: bob }] } } });
    const acc = await db.bankAccount.create({ data: { ownerId: alice, householdId: hh.id, name: 'Compartida', openingBalance: 100 } });
    await db.transaction.create({ data: { userId: bob, accountId: acc.id, date: noon('2026-10-02'), amount: -20, category: 'ocio', description: 'De Bob' } });
    await deleteAccount(bob, PW, 'bob@test.dev');
    expect(await db.transaction.findFirstOrThrow({ where: { accountId: acc.id } })).toMatchObject({ description: 'De Bob', userId: alice });
    expect((await db.bankAccount.findUniqueOrThrow({ where: { id: acc.id } })).ownerId).toBe(alice);
  });
  it('cuenta compartida sin nadie más: se borra con el resto', async () => {
    const hh = await db.household.create({ data: { name: 'Solo', members: { create: [{ userId: alice, role: 'owner' }] } } });
    await db.bankAccount.create({ data: { ownerId: alice, householdId: hh.id, name: 'Sola', openingBalance: 1 } });
    await deleteAccount(alice, PW, 'alice@test.dev');
    expect(await db.bankAccount.count()).toBe(0);
    expect(await db.household.count()).toBe(0);
  });
});

describe('seguridad: contraseña y sesiones', () => {
  const sess = async (userId: string, n: string) => (await db.session.create({ data: { userId, tokenHash: sha256(n), userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/120 Safari/537', ip: '1.2.3.4', expiresAt: new Date(Date.now() + 1e9) } })).id;
  it('cambia la contraseña verificando la actual y cierra las demás sesiones', async () => {
    await sess(alice, 'actual'); await sess(alice, 'otra1'); await sess(alice, 'otra2'); await sess(bob, 'de-bob');
    await expect(changePassword(alice, sha256('actual'), { current: 'mal', next: 'nueva-contraseña-456' })).rejects.toThrow(/actual no es correcta/);
    const r = await changePassword(alice, sha256('actual'), { current: PW, next: 'nueva-contraseña-456' });
    expect(r.revoked).toBe(2);
    const u = await db.user.findUniqueOrThrow({ where: { id: alice } });
    expect(await verifyPassword('nueva-contraseña-456', u.passwordHash)).toBe(true);
    expect(await verifyPassword(PW, u.passwordHash)).toBe(false);
    expect((await db.session.findMany({ where: { userId: alice } })).map((s) => s.tokenHash)).toEqual([sha256('actual')]);
    expect(await db.session.count({ where: { userId: bob } })).toBe(1); // las de otros, intactas
  });
  it.each([['corta', /al menos 10/], ['x'.repeat(201), /demasiado larga/], [PW, /distinta/], ['alice-alice-123', /email/], ['password123', /común/]])('rechaza contraseña inadecuada «%s»', async (next, re) => {
    await expect(changePassword(alice, 'x', { current: PW, next: next.length > 50 ? next : next })).rejects.toThrow(re);
  });
  it('lista sesiones marcando la actual y permite cerrar otras (no la actual ni las ajenas)', async () => {
    const cur = await sess(alice, 'actual'); const other = await sess(alice, 'otra'); const theirs = await sess(bob, 'bob');
    const list = await listSessions(alice, sha256('actual'));
    expect(list.map((s) => [s.current, s.device])).toEqual(expect.arrayContaining([[true, 'Chrome en Windows'], [false, 'Chrome en Windows']]));
    expect(JSON.stringify(list)).not.toContain('tokenHash');
    await expect(revokeSession(alice, cur, sha256('actual'))).rejects.toThrow(/no encontrada/);
    await expect(revokeSession(alice, theirs, sha256('actual'))).rejects.toThrow(/no encontrada/);
    await revokeSession(alice, other, sha256('actual'));
    expect(await revokeOtherSessions(alice, sha256('actual'))).toBe(0);
    expect(await db.session.count({ where: { userId: bob } })).toBe(1);
  });
});

describe('perfil y zona horaria', () => {
  it('valida y guarda perfil, zona horaria y categorías de noticias sin pisar otras preferencias', async () => {
    await db.user.update({ where: { id: alice }, data: { preferences: { ai: { provider: 'local' }, followedNews: ['ia'] } } });
    await expect(updateProfile(alice, { name: '', city: 'Madrid', timezone: 'Europe/Madrid', theme: 'dark', followedNews: [] })).rejects.toThrow(/nombre/);
    await expect(updateProfile(alice, { name: 'A', city: 'Madrid', timezone: 'Marte/Olimpo', theme: 'dark', followedNews: [] })).rejects.toThrow(/Zona horaria/);
    await expect(updateProfile(alice, { name: 'A', city: 'Madrid', timezone: 'UTC', theme: 'neon', followedNews: [] })).rejects.toThrow();
    await expect(updateProfile(alice, { name: 'A', city: 'Madrid', timezone: 'UTC', theme: 'dark', followedNews: ['inventada'] })).rejects.toThrow();
    await updateProfile(alice, { name: 'Alicia', city: 'Sevilla', timezone: 'Atlantic/Canary', theme: 'dark', followedNews: ['economia', 'ia'] });
    const u = await db.user.findUniqueOrThrow({ where: { id: alice } });
    expect(u).toMatchObject({ name: 'Alicia', city: 'Sevilla', timezone: 'Atlantic/Canary', theme: 'dark' });
    expect(u.preferences).toEqual({ ai: { provider: 'local' }, followedNews: ['economia', 'ia'] });
  });
  it('tzOffsetMinutes respeta el horario de verano', () => {
    expect(tzOffsetMinutes('Europe/Madrid', new Date('2026-07-01T12:00:00Z'))).toBe(-120);
    expect(tzOffsetMinutes('Europe/Madrid', new Date('2026-12-01T12:00:00Z'))).toBe(-60);
    expect(tzOffsetMinutes('America/New_York', new Date('2026-07-01T12:00:00Z'))).toBe(240);
    expect(tzOffsetMinutes('Asia/Kolkata', new Date('2026-07-01T12:00:00Z'))).toBe(-330);
    expect(tzOffsetMinutes('Nada/Valido')).toBe(0);
    expect(isValidTimezone('UTC')).toBe(true);
  });
});
