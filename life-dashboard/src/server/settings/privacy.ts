import 'server-only';
import { randomBytes } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { verifyPassword } from '@/lib/crypto';
import { EXPORT_VERSION, IMPORT_MAX_BYTES, exportSchema, type ExportFile, type ExportFileInput } from '@/lib/privacy-format';
import { ServiceError, fail, issue } from '../life/core';

type Tx = Prisma.TransactionClient;
const iso = (d: Date) => d.toISOString();
const optIso = (d: Date | null) => (d ? d.toISOString() : null);
const dec = (d: { toString(): string } | null) => (d == null ? null : d.toString());

/** Todos los datos PROPIOS del usuario en un único JSON portable. Sin contraseña, sesiones, claves ni tokens de conexiones. */
export async function exportUserData(userId: string, now = new Date()): Promise<ExportFileInput> {
  const [u, projects, tasks, calendars, emails, accounts, budgets, portfolios, workouts, metrics, goals, trips, family, shopping, automations, conversations, audit] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId } }),
    db.project.findMany({ where: { userId } }),
    db.task.findMany({ where: { userId } }),
    db.calendar.findMany({ where: { userId, accountId: null }, include: { events: true } }), // los calendarios suscritos se vuelven a sincronizar desde su origen
    db.email.findMany({ where: { userId } }),
    db.bankAccount.findMany({ where: { ownerId: userId }, include: { transactions: { orderBy: { date: 'asc' } } } }),
    db.budget.findMany({ where: { userId } }),
    db.portfolio.findMany({ where: { userId }, include: { investments: { include: { dividends: true } }, snapshots: true } }),
    db.workout.findMany({ where: { userId } }),
    db.healthMetric.findMany({ where: { userId } }),
    db.healthGoal.findMany({ where: { userId } }),
    db.trip.findMany({ where: { userId }, include: { bookings: true, days: true, packing: true } }),
    db.familyMember.findMany({ where: { userId } }),
    db.shoppingItem.findMany({ where: { userId } }),
    db.automation.findMany({ where: { userId } }),
    db.aIConversation.findMany({ where: { userId }, include: { messages: { where: { role: { in: ['user', 'assistant'] } }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } } }),
    db.auditLog.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
  ]);
  const prefs = (u.preferences ?? {}) as { followedNews?: string[] };
  return {
    app: 'life-dashboard', version: EXPORT_VERSION, exportedAt: iso(now),
    profile: { name: u.name, city: u.city, timezone: u.timezone, locale: u.locale, currency: u.currency, theme: u.theme as 'light' | 'dark' | 'system', followedNews: (prefs.followedNews ?? []) as never },
    projects: projects.map((p) => ({ ref: p.id, name: p.name, description: p.description, status: p.status as 'active', priority: p.priority, color: p.color, targetDate: optIso(p.targetDate) })),
    tasks: tasks.map((t) => ({ ref: t.id, projectRef: t.projectId, parentRef: t.parentId, title: t.title, description: t.description, priority: t.priority, status: t.status as 'next', dueDate: optIso(t.dueDate), estimateMinutes: t.estimateMinutes, tags: t.tags, recurrence: t.recurrence as 'daily' | null, remindAt: optIso(t.remindAt), completedAt: optIso(t.completedAt) })),
    calendars: calendars.map((c) => ({ name: c.name, color: c.color, isDefault: c.isDefault, events: c.events.map((e) => ({ title: e.title, description: e.description, location: e.location, startsAt: iso(e.startsAt), endsAt: iso(e.endsAt), allDay: e.allDay, attendees: e.attendees, important: e.important })) })),
    emails: emails.map((e) => ({ folder: e.folder as 'inbox', fromName: e.fromName, fromEmail: e.fromEmail, toEmails: e.toEmails, subject: e.subject, body: e.body, snippet: e.snippet, receivedAt: iso(e.receivedAt), read: e.read, starred: e.starred, important: e.important, needsReply: e.needsReply, replied: e.replied, deadline: optIso(e.deadline), category: e.category, summary: e.summary })),
    bankAccounts: accounts.map((a) => ({ name: a.name, kind: a.kind as 'checking', currency: a.currency, openingBalance: dec(a.openingBalance)!, transactions: a.transactions.map((t) => ({ date: iso(t.date), amount: dec(t.amount)!, category: t.category, description: t.description, merchant: t.merchant, recurring: t.recurring, upcoming: t.upcoming, source: t.source as 'manual' })) })),
    budgets: budgets.map((b) => ({ category: b.category, monthly: dec(b.monthly)! })),
    portfolios: portfolios.map((p) => ({ name: p.name, currency: p.currency, investments: p.investments.map((i) => ({ assetType: i.assetType as 'stock', symbol: i.symbol, name: i.name, quantity: dec(i.quantity)!, avgCost: dec(i.avgCost)!, currentPrice: dec(i.currentPrice)!, dividendYield: dec(i.dividendYield)!, isin: i.isin, dividends: i.dividends.map((d) => ({ date: iso(d.date), amount: dec(d.amount)! })) })), snapshots: p.snapshots.map((s) => ({ date: iso(s.date), value: dec(s.value)!, cost: dec(s.cost)! })) })),
    workouts: workouts.map((w) => ({ kind: w.kind as 'gym', title: w.title, date: iso(w.date), minutes: w.minutes, calories: w.calories, notes: w.notes, planned: w.planned })),
    healthMetrics: metrics.map((m) => ({ kind: m.kind as 'weight', date: iso(m.date), value: m.value, source: m.source })),
    healthGoals: goals.map((g) => ({ kind: g.kind as 'steps', target: g.target })),
    trips: trips.map((t) => ({ name: t.name, destination: t.destination, startDate: iso(t.startDate), endDate: iso(t.endDate), budget: dec(t.budget), notes: t.notes, bookings: t.bookings.map((b) => ({ kind: b.kind as 'flight', title: b.title, reference: b.reference, startsAt: optIso(b.startsAt), endsAt: optIso(b.endsAt), cost: dec(b.cost), details: b.details })), itinerary: t.days.map((d) => ({ date: iso(d.date), time: d.time, title: d.title, notes: d.notes })), packing: t.packing.map((p) => ({ label: p.label, packed: p.packed })) })),
    family: family.map((m) => ({ name: m.name, relation: m.relation, birthday: optIso(m.birthday), color: m.color, notes: m.notes })),
    shopping: shopping.map((s) => ({ label: s.label, done: s.done })),
    automations: automations.map((a) => ({ name: a.name, triggerType: a.triggerType, triggerConfig: a.triggerConfig as Record<string, unknown>, actionType: a.actionType, actionConfig: a.actionConfig as Record<string, unknown>, requiresConfirmation: a.requiresConfirmation, enabled: a.enabled })),
    conversations: conversations.map((c) => ({ title: c.title, createdAt: iso(c.createdAt), messages: c.messages.map((m) => ({ role: m.role as 'user', content: m.content, createdAt: iso(m.createdAt) })) })),
    auditLog: audit.map((a) => ({ entity: a.entity, entityId: a.entityId, action: a.action, before: a.before, after: a.after, createdAt: iso(a.createdAt) })),
  };
}

/** id con forma de cuid (c + 24 hex): pasa las validaciones `z.string().cuid()` del resto de la aplicación. */
const newId = () => `c${randomBytes(12).toString('hex')}`;
const d = (s: string) => new Date(s);
const dn = (s: string | null | undefined) => (s ? new Date(s) : null);

export interface ImportReport { counts: Record<string, number>; total: number }

/**
 * Importa un archivo exportado AÑADIENDO sus datos a los que ya tienes (con ids nuevos): no pisa ni borra nada.
 * Se valida entero antes de escribir y se guarda todo en una sola transacción: o entra completo o no entra nada.
 * Importar el mismo archivo dos veces duplica los datos (es una operación de «añadir»).
 */
export async function importUserData(userId: string, raw: string): Promise<ImportReport> {
  if (raw.length > IMPORT_MAX_BYTES) return fail('El archivo es demasiado grande');
  let json: unknown;
  try { json = JSON.parse(raw); } catch { return fail('El archivo no es un JSON válido'); }
  const parsed = exportSchema.safeParse(json);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return fail(i?.path.join('.') === 'app' ? 'Este archivo no es una exportación de Life Dashboard' : `Archivo no válido (${i?.path.join('.') || 'formato'}): ${issue(parsed.error)}`);
  }
  const f = parsed.data;
  const counts: Record<string, number> = {};
  const bump = (k: string, n: number) => { counts[k] = (counts[k] ?? 0) + n; };

  try {
  await db.$transaction(async (tx) => {
    const pid = new Map<string, string>();
    if (f.projects.length) {
      await tx.project.createMany({ data: f.projects.map((p) => { const id = newId(); pid.set(p.ref, id); return { id, userId, name: p.name, description: p.description ?? null, status: p.status, priority: p.priority, color: p.color, targetDate: dn(p.targetDate) }; }) });
      bump('proyectos', f.projects.length);
    }
    const tid = new Map(f.tasks.map((t) => [t.ref, newId()]));
    const rootRefs = new Set(f.tasks.filter((t) => !t.parentRef || !tid.has(t.parentRef)).map((t) => t.ref));
    const roots = f.tasks.filter((t) => rootRefs.has(t.ref));
    const subs = f.tasks.filter((t) => !rootRefs.has(t.ref) && rootRefs.has(t.parentRef!)); // el modelo solo admite un nivel de subtareas
    const taskRow = (t: ExportFile['tasks'][number]) => ({ id: tid.get(t.ref)!, userId, projectId: t.projectRef ? (pid.get(t.projectRef) ?? null) : null, parentId: t.parentRef && rootRefs.has(t.parentRef) ? tid.get(t.parentRef)! : null, title: t.title, description: t.description ?? null, priority: t.priority, status: t.status, dueDate: dn(t.dueDate), estimateMinutes: t.estimateMinutes ?? null, tags: t.tags, recurrence: t.recurrence ?? null, remindAt: dn(t.remindAt), completedAt: dn(t.completedAt) });
    if (roots.length) await tx.task.createMany({ data: roots.map((t) => ({ ...taskRow(t), parentId: null })) });
    if (subs.length) await tx.task.createMany({ data: subs.map(taskRow) });
    bump('tareas', roots.length + subs.length);

    for (const c of f.calendars) {
      // Solo es la predeterminada si el usuario aún no tiene una (nunca dos).
      const hasDefault = !!(await tx.calendar.findFirst({ where: { userId, isDefault: true }, select: { id: true } }));
      const cal = await tx.calendar.create({ data: { userId, name: c.name, color: c.color, isDefault: c.isDefault && !hasDefault } });
      if (c.events.length) await tx.event.createMany({ data: c.events.map((e) => ({ calendarId: cal.id, title: e.title, description: e.description ?? null, location: e.location ?? null, startsAt: d(e.startsAt), endsAt: d(e.endsAt), allDay: e.allDay, attendees: e.attendees, important: e.important })) });
      bump('eventos', c.events.length);
    }
    if (f.emails.length) { await tx.email.createMany({ data: f.emails.map((e) => ({ userId, folder: e.folder, fromName: e.fromName, fromEmail: e.fromEmail, toEmails: e.toEmails, subject: e.subject, body: e.body, snippet: e.snippet, receivedAt: d(e.receivedAt), read: e.read, starred: e.starred, important: e.important, needsReply: e.needsReply, replied: e.replied, deadline: dn(e.deadline), category: e.category ?? null, summary: e.summary ?? null })) }); bump('emails', f.emails.length); }

    for (const a of f.bankAccounts) {
      const acc = await tx.bankAccount.create({ data: { ownerId: userId, name: a.name, kind: a.kind, currency: a.currency, openingBalance: a.openingBalance } });
      if (a.transactions.length) await tx.transaction.createMany({ data: a.transactions.map((t) => ({ userId, accountId: acc.id, date: d(t.date), amount: t.amount, category: t.category, description: t.description, merchant: t.merchant ?? null, recurring: t.recurring, upcoming: t.upcoming, source: t.source })) });
      bump('movimientos', a.transactions.length);
    }
    for (const b of f.budgets) { await tx.budget.upsert({ where: { userId_category: { userId, category: b.category } }, create: { userId, category: b.category, monthly: b.monthly }, update: {} }); bump('presupuestos', 1); } // si ya hay uno para esa categoría, se respeta el actual
    for (const p of f.portfolios) {
      const port = await tx.portfolio.create({ data: { userId, name: p.name, currency: p.currency } });
      for (const i of p.investments) {
        const inv = await tx.investment.create({ data: { portfolioId: port.id, assetType: i.assetType, symbol: i.symbol, name: i.name, quantity: i.quantity, avgCost: i.avgCost, currentPrice: i.currentPrice, dividendYield: i.dividendYield, isin: i.isin ?? null } });
        if (i.dividends.length) await tx.dividend.createMany({ data: i.dividends.map((x) => ({ investmentId: inv.id, date: d(x.date), amount: x.amount })) });
      }
      if (p.snapshots.length) await tx.portfolioSnapshot.createMany({ data: p.snapshots.map((s) => ({ portfolioId: port.id, date: d(s.date), value: s.value, cost: s.cost })), skipDuplicates: true });
      bump('inversiones', p.investments.length);
    }
    if (f.workouts.length) { await tx.workout.createMany({ data: f.workouts.map((w) => ({ userId, kind: w.kind, title: w.title, date: d(w.date), minutes: w.minutes, calories: w.calories ?? null, notes: w.notes ?? null, planned: w.planned })) }); bump('entrenos', f.workouts.length); }
    if (f.healthMetrics.length) { await tx.healthMetric.createMany({ data: f.healthMetrics.map((m) => ({ userId, kind: m.kind, date: d(m.date), value: m.value, source: m.source })), skipDuplicates: true }); bump('mediciones', f.healthMetrics.length); }
    for (const g of f.healthGoals) await tx.healthGoal.upsert({ where: { userId_kind: { userId, kind: g.kind } }, create: { userId, kind: g.kind, target: g.target }, update: {} });
    for (const t of f.trips) {
      const trip = await tx.trip.create({ data: { userId, name: t.name, destination: t.destination, startDate: d(t.startDate), endDate: d(t.endDate), budget: t.budget ?? null, notes: t.notes ?? null } });
      if (t.bookings.length) await tx.travel.createMany({ data: t.bookings.map((b) => ({ tripId: trip.id, kind: b.kind, title: b.title, reference: b.reference ?? null, startsAt: dn(b.startsAt), endsAt: dn(b.endsAt), cost: b.cost ?? null, details: b.details ?? null })) });
      if (t.itinerary.length) await tx.itineraryItem.createMany({ data: t.itinerary.map((i) => ({ tripId: trip.id, date: d(i.date), time: i.time ?? null, title: i.title, notes: i.notes ?? null })) });
      if (t.packing.length) await tx.packingItem.createMany({ data: t.packing.map((p) => ({ tripId: trip.id, label: p.label, packed: p.packed })) });
    }
    bump('viajes', f.trips.length);
    if (f.family.length) { await tx.familyMember.createMany({ data: f.family.map((m) => ({ userId, name: m.name, relation: m.relation, birthday: dn(m.birthday), color: m.color, notes: m.notes ?? null })) }); bump('familia', f.family.length); }
    if (f.shopping.length) { await tx.shoppingItem.createMany({ data: f.shopping.map((s) => ({ userId, label: s.label, done: s.done })) }); bump('compra', f.shopping.length); }
    if (f.automations.length) { await tx.automation.createMany({ data: f.automations.map((a) => ({ userId, name: a.name, triggerType: a.triggerType, triggerConfig: a.triggerConfig as Prisma.InputJsonValue, actionType: a.actionType, actionConfig: a.actionConfig as Prisma.InputJsonValue, requiresConfirmation: a.requiresConfirmation, enabled: false })) }); bump('automatizaciones', f.automations.length); } // llegan desactivadas: se revisan antes de activarlas
    for (const c of f.conversations) {
      const conv = await tx.aIConversation.create({ data: { userId, title: c.title, createdAt: d(c.createdAt) } });
      if (c.messages.length) await tx.aIMessage.createMany({ data: c.messages.map((m) => ({ conversationId: conv.id, role: m.role, content: m.content, createdAt: d(m.createdAt) })) });
    }
    bump('conversaciones', f.conversations.length);
  }, { timeout: 120_000, maxWait: 10_000 });
  } catch (e) {
    if (e instanceof ServiceError) throw e;
    console.error('[import] fallo al importar', e); // la transacción se ha revertido: no queda nada a medias
    return fail('No se pudo importar el archivo: algún dato no es válido. No se ha importado nada.');
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return { counts: Object.fromEntries(Object.entries(counts).filter(([, n]) => n > 0)), total };
}

async function requirePassword(userId: string, password: string) {
  const u = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { passwordHash: true } });
  if (!password || !(await verifyPassword(password, u.passwordHash))) throw new ServiceError('La contraseña no es correcta');
}

/**
 * Cuentas bancarias compartidas: nunca se pierde el dinero de la otra persona. Si la cuenta es mía y la comparte alguien más,
 * la propiedad pasa a esa persona (y sus movimientos creados por mí se le reasignan); si no, se borra con sus movimientos.
 */
async function detachSharedAccounts(tx: Tx, userId: string) {
  const owned = await tx.bankAccount.findMany({ where: { ownerId: userId, householdId: { not: null } }, include: { household: { include: { members: { orderBy: { createdAt: 'asc' } } } } } });
  for (const a of owned) {
    const heir = a.household?.members.find((m) => m.userId !== userId);
    if (!heir) continue; // sin nadie más: se borrará con el resto de mis datos
    await tx.bankAccount.update({ where: { id: a.id }, data: { ownerId: heir.userId } });
    await tx.transaction.updateMany({ where: { accountId: a.id, userId }, data: { userId: heir.userId } });
    await tx.householdMember.updateMany({ where: { householdId: a.householdId!, userId: heir.userId }, data: { role: 'owner' } });
  }
  // Lo que yo aporté a cuentas de otras personas se les reasigna al propietario (si no, borrar mi usuario se llevaría esos movimientos).
  const foreign = await tx.bankAccount.findMany({ where: { ownerId: { not: userId }, household: { members: { some: { userId } } } }, select: { id: true, ownerId: true } });
  for (const a of foreign) await tx.transaction.updateMany({ where: { accountId: a.id, userId }, data: { userId: a.ownerId } });
  await tx.householdMember.deleteMany({ where: { userId } });
  await tx.household.deleteMany({ where: { members: { none: {} } } });
}

async function wipe(tx: Tx, userId: string) {
  await detachSharedAccounts(tx, userId);
  await tx.bankAccount.deleteMany({ where: { ownerId: userId } }); // movimientos en cascada
  await tx.calendar.deleteMany({ where: { userId } });
  await tx.email.deleteMany({ where: { userId } });
  await tx.task.deleteMany({ where: { userId } });
  await tx.project.deleteMany({ where: { userId } });
  await tx.newsArticle.deleteMany({ where: { userId } });
  await tx.budget.deleteMany({ where: { userId } });
  await tx.portfolio.deleteMany({ where: { userId } });
  await tx.workout.deleteMany({ where: { userId } });
  await tx.healthMetric.deleteMany({ where: { userId } });
  await tx.healthGoal.deleteMany({ where: { userId } });
  await tx.trip.deleteMany({ where: { userId } });
  await tx.familyMember.deleteMany({ where: { userId } });
  await tx.shoppingItem.deleteMany({ where: { userId } });
  await tx.notification.deleteMany({ where: { userId } });
  await tx.automation.deleteMany({ where: { userId } });
  await tx.aIConversation.deleteMany({ where: { userId } });
  await tx.aIProposal.deleteMany({ where: { userId } });
  await tx.dashboardLayout.deleteMany({ where: { userId } });
  await tx.auditLog.deleteMany({ where: { userId } });
  await tx.account.deleteMany({ where: { userId } }); // conexiones y claves guardadas
}

/** Borra TODOS los datos del usuario pero conserva su cuenta, perfil y sesión. Pide la contraseña. */
export async function deleteUserData(userId: string, password: string) {
  await requirePassword(userId, password);
  await db.$transaction(async (tx) => { await wipe(tx, userId); await tx.user.update({ where: { id: userId }, data: { preferences: {} } }); }, { timeout: 60_000 });
}

/** Elimina la cuenta y todo lo asociado. Exige la contraseña y escribir el email. Las cuentas compartidas pasan a la otra persona. */
export async function deleteAccount(userId: string, password: string, emailConfirm: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
  if (emailConfirm.trim().toLowerCase() !== user.email) return fail('El email escrito no coincide con el de tu cuenta');
  await requirePassword(userId, password);
  await db.$transaction(async (tx) => { await wipe(tx, userId); await tx.session.deleteMany({ where: { userId } }); await tx.user.delete({ where: { id: userId } }); }, { timeout: 60_000 });
}
