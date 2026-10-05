import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/crypto';

const db = new PrismaClient();

export const DEMO_EMAIL = 'demo@lifedashboard.dev';
export const DEMO_PASSWORD = 'demo-password-123';

// PRNG determinista para que los datos demo sean reproducibles.
let seed = 42;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const between = (a: number, b: number) => a + rnd() * (b - a);

const now = new Date();
const day = (offset: number, h = 0, m = 0) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, h, m);

async function main() {
  await db.user.deleteMany({ where: { email: DEMO_EMAIL } });
  await db.user.deleteMany({ where: { email: 'pareja@lifedashboard.dev' } });
  await db.household.deleteMany({ where: { name: 'Hogar demo' } });

  const user = await db.user.create({
    data: { email: DEMO_EMAIL, name: 'Alex Demo', passwordHash: await hashPassword(DEMO_PASSWORD), city: 'Madrid' },
  });
  const partner = await db.user.create({
    data: { email: 'pareja@lifedashboard.dev', name: 'Sam Demo', passwordHash: await hashPassword(DEMO_PASSWORD) },
  });
  const uid = user.id;

  const household = await db.household.create({
    data: { name: 'Hogar demo', members: { create: [{ userId: uid, role: 'owner' }, { userId: partner.id }] } },
  });

  // ── Proyectos
  const [pDash, pFin, pIA, pOtros] = await Promise.all(
    [
      { name: 'Life Dashboard', description: 'Mi centro de control personal', status: 'active', priority: 1, color: '#6366f1', targetDate: day(45) },
      { name: 'Finanzas', description: 'Ordenar presupuesto y ahorro anual', status: 'active', priority: 2, color: '#10b981', targetDate: day(90) },
      { name: 'IA', description: 'Experimentos con asistentes y automatización', status: 'planned', priority: 2, color: '#f59e0b', targetDate: day(120) },
      { name: 'Otros', description: 'Gestiones varias', status: 'active', priority: 3, color: '#64748b', targetDate: null },
    ].map((p) => db.project.create({ data: { ...p, userId: uid } })),
  );

  // ── Tareas
  const t = (title: string, o: Partial<{ priority: number; status: string; due: number | null; est: number; project: string; tags: string[]; recurrence: string; description: string }> = {}) => ({
    userId: uid, title, priority: o.priority ?? 2, status: o.status ?? 'next', dueDate: o.due == null ? null : day(o.due, 18),
    estimateMinutes: o.est ?? 30, projectId: o.project, tags: o.tags ?? [], recurrence: o.recurrence, description: o.description,
    completedAt: o.status === 'done' ? day(-1, 12) : null,
  });
  const main1 = await db.task.create({ data: t('Diseñar esquema de base de datos', { priority: 1, status: 'in_progress', due: 1, est: 90, project: pDash!.id, tags: ['dev'] }) });
  await db.task.createMany({
    data: [
      { ...t('Definir tablas de auditoría', { est: 20, status: 'next' }), parentId: main1.id, projectId: pDash!.id },
      { ...t('Revisar relaciones y índices', { est: 25, status: 'inbox' }), parentId: main1.id, projectId: pDash!.id },
      t('Declaración trimestral de impuestos', { priority: 1, due: -2, est: 60, project: pFin!.id, tags: ['impuestos'] }),
      t('Revisar suscripciones y cancelar las que no uso', { priority: 2, due: 3, est: 25, project: pFin!.id }),
      t('Preparar presupuesto del próximo mes', { priority: 2, due: 5, est: 40, project: pFin!.id }),
      t('Probar modelos locales con Ollama', { priority: 3, status: 'inbox', est: 60, project: pIA!.id, tags: ['ia'] }),
      t('Escribir prompt del asistente semanal', { priority: 2, status: 'waiting', est: 30, project: pIA!.id }),
      t('Llamar al seguro del coche', { priority: 1, due: 0, est: 15, project: pOtros!.id }),
      t('Renovar DNI', { priority: 2, due: 20, est: 45, project: pOtros!.id }),
      t('Comprar regalo cumpleaños de mamá', { priority: 2, due: 6, est: 45 }),
      { ...t('Reservar pista de pádel', { priority: 3, due: 2, est: 10 }), remindAt: day(2, 9) },
      t('Revisión semanal', { priority: 2, due: 7, est: 30, recurrence: 'weekly', tags: ['rutina'] }),
      t('Preparar maleta para Lisboa', { priority: 2, due: 28, est: 30 }),
      t('Enviar factura a cliente', { priority: 1, status: 'done', due: -1, est: 10, project: pFin!.id }),
      t('Actualizar CV', { priority: 3, status: 'done', est: 40 }),
    ],
  });

  // ── Calendario
  const [calP, calT, calF] = await Promise.all([
    db.calendar.create({ data: { userId: uid, name: 'Personal', color: '#6366f1', isDefault: true } }),
    db.calendar.create({ data: { userId: uid, name: 'Trabajo', color: '#0ea5e9' } }),
    db.calendar.create({ data: { userId: uid, name: 'Familia', color: '#10b981' } }),
  ]);
  const ev = (calendarId: string, title: string, off: number, h: number, mins: number, o: { location?: string; attendees?: string[]; description?: string; important?: boolean } = {}) => ({
    calendarId, title, startsAt: day(off, h, 0), endsAt: new Date(day(off, h, 0).getTime() + mins * 60_000), ...o,
  });
  await db.event.createMany({
    data: [
      ev(calT.id, 'Daily de equipo', 0, 9, 15, { location: 'Meet', attendees: ['equipo@empresa.test'] }),
      ev(calT.id, 'Reunión de producto', 0, 11, 60, { location: 'Sala 3', attendees: ['ana@empresa.test', 'luis@empresa.test'], important: true }),
      ev(calP.id, 'Comida con Marta', 0, 14, 90, { location: 'Café Central' }),
      ev(calP.id, 'Gimnasio', 0, 19, 60, { location: 'Gym Centro' }),
      ev(calT.id, 'Planificación semanal', 1, 10, 60),
      ev(calT.id, 'Llamada con cliente', 1, 10, 45, { description: 'Se solapa con la planificación (demo de conflicto)' }),
      ev(calF.id, 'Cena familiar', 1, 21, 120, { location: 'Casa de los abuelos' }),
      ev(calP.id, 'Pádel con Sam', 2, 20, 90, { location: 'Club Padel Norte' }),
      ev(calT.id, 'Entrega de informe trimestral', 3, 17, 30, { important: true }),
      ev(calP.id, 'Dentista', 4, 12, 45, { location: 'Clínica Sonrisa' }),
      ev(calF.id, 'Cumpleaños de mamá', 6, 20, 180, { important: true }),
      ev(calT.id, 'Workshop de IA', 8, 10, 240, { location: 'Online' }),
      ev(calP.id, 'Revisión coche (ITV)', 11, 9, 60),
      ev(calP.id, 'Vuelo a Lisboa', 27, 8, 120, { important: true }),
      { calendarId: calF.id, title: 'Fin de semana en la sierra', startsAt: day(9, 0, 0), endsAt: day(10, 23, 59), allDay: true, location: 'Navacerrada' },
      ev(calT.id, 'Retrospectiva mensual', -3, 16, 60),
      ev(calP.id, 'Cine', -2, 21, 150),
    ],
  });

  // ── Email
  const em = (fromName: string, fromEmail: string, subject: string, body: string, minsAgo: number, o: Partial<{ read: boolean; starred: boolean; important: boolean; needsReply: boolean; deadline: number; category: string; folder: string; summary: string; to: string[] }> = {}) => ({
    userId: uid, fromName, fromEmail, subject, body, snippet: body.slice(0, 110), receivedAt: new Date(now.getTime() - minsAgo * 60_000),
    read: o.read ?? false, starred: o.starred ?? false, important: o.important ?? false, needsReply: o.needsReply ?? false,
    deadline: o.deadline != null ? day(o.deadline, 18) : null, category: o.category ?? 'personal', folder: o.folder ?? 'inbox', summary: o.summary, toEmails: o.to ?? ['alex@demo.test'],
  });
  await db.email.createMany({
    data: [
      em('Ana García', 'ana@empresa.test', 'Propuesta de contrato: necesito tu confirmación', 'Hola Alex, adjunto la propuesta final. Necesito tu confirmación antes del viernes para cerrar con el cliente. Avísame si hay algún cambio.', 35, { important: true, needsReply: true, deadline: 3, category: 'trabajo', summary: 'Piden confirmar el contrato antes del viernes.' }),
      em('Banco Demo', 'avisos@banco.test', 'Recibo de la hipoteca disponible', 'Tu recibo mensual de 780,00 € se cargará el día 5. No es necesaria ninguna acción.', 120, { category: 'finanzas', important: true }),
      em('Marta López', 'marta@correo.test', 'Re: comida de hoy', '¿Seguimos a las 14:00 en el Café Central? Si quieres reservo mesa en la terraza.', 200, { needsReply: true, category: 'personal' }),
      em('Aerolínea Demo', 'reservas@aerolinea.test', 'Tu vuelo a Lisboa: check-in disponible', 'El check-in online abre 48 horas antes de la salida. Localizador: XK29PL.', 400, { category: 'viajes', starred: true }),
      em('Luis Martín', 'luis@empresa.test', 'Entrega del informe trimestral', 'Recuerda que necesitamos el informe antes del jueves a las 17:00. Gracias.', 600, { important: true, needsReply: true, deadline: 2, category: 'trabajo' }),
      em('Newsletter IA Semanal', 'news@iasemanal.test', 'Los 5 avances de IA de esta semana', 'Esta semana: nuevos modelos locales, agentes más fiables y herramientas para automatizar tareas.', 800, { read: true, category: 'newsletter' }),
      em('Seguros Demo', 'cliente@seguros.test', 'Renovación de tu póliza de coche', 'Tu póliza vence en 12 días. Revisa las condiciones y renueva con un 10% de descuento.', 1500, { needsReply: true, deadline: 9, category: 'finanzas' }),
      em('Sam Demo', 'sam@correo.test', 'Lista de la compra', 'He apuntado lo que falta: leche, pan, fruta y café. ¿Puedes pasar tú?', 1900, { read: true }),
      em('Club Padel Norte', 'info@padelnorte.test', 'Confirmación de reserva', 'Tu pista del miércoles a las 20:00 está confirmada.', 2500, { read: true, category: 'personal' }),
      em('Hotel Alfama', 'hola@hotelalfama.test', 'Confirmación de reserva en Lisboa', 'Reserva confirmada del 31/10 al 03/11. Desayuno incluido.', 3000, { read: true, starred: true, category: 'viajes' }),
      em('Alex Demo', 'alex@demo.test', 'Re: Propuesta de presupuesto', 'Gracias, lo reviso y te confirmo mañana.', 4000, { folder: 'sent', read: true, to: ['luis@empresa.test'] }),
      em('Alex Demo', 'alex@demo.test', 'Notas de la reunión', 'Resumen de acuerdos: 1) cerrar alcance, 2) fecha de entrega, 3) revisar presupuesto.', 5000, { folder: 'sent', read: true, to: ['equipo@empresa.test', 'ana@empresa.test'] }),
    ],
  });

  // ── Noticias
  const news = [
    ['ia', 'Nuevos modelos abiertos reducen el coste de ejecutar IA en local', 'IA Hoy', 'Los últimos modelos ligeros alcanzan un rendimiento cercano a los grandes con una fracción de memoria, facilitando su uso en portátiles.', 90],
    ['ia', 'Los agentes de IA empiezan a automatizar tareas administrativas', 'Tech Review', 'Empresas pilotan agentes que gestionan correo y calendario con supervisión humana obligatoria.', 70],
    ['tecnologia', 'Llega una nueva generación de chips eficientes para móviles', 'Hardware Weekly', 'Los fabricantes prometen más autonomía y mejor rendimiento en IA en el propio dispositivo.', 55],
    ['tecnologia', 'La UE publica nuevas guías sobre privacidad de datos personales', 'Digital EU', 'Las guías refuerzan el derecho a exportar y borrar datos de los servicios digitales.', 60],
    ['economia', 'La inflación en España se modera por tercer mes consecutivo', 'Economía Diaria', 'El IPC baja una décima gracias al abaratamiento de la energía, según datos preliminares.', 85],
    ['economia', 'El mercado laboral mantiene el ritmo de creación de empleo', 'Mercados ES', 'La afiliación sube y el paro registrado cae en el último mes.', 50],
    ['finanzas', 'Los bancos centrales mantienen tipos y apuntan a recortes graduales', 'Finanzas Hoy', 'Las expectativas de recortes mejoran el tono de los mercados de renta variable.', 80],
    ['finanzas', 'Los ETFs globales atraen flujos récord de pequeños inversores', 'Invertir Más', 'La inversión indexada sigue ganando peso frente a los fondos de gestión activa.', 45],
    ['deportes', 'Gran jornada de pádel: finales de infarto en el circuito', 'Deporte Total', 'Las parejas favoritas llegan a semifinales tras partidos muy igualados.', 40],
    ['deportes', 'El equipo nacional anuncia su convocatoria para el próximo parón', 'Marca Demo', 'El seleccionador incluye varias novedades en la lista.', 35],
    ['espana', 'Aprobado el plan de ayudas al transporte público para el próximo año', 'Actualidad ES', 'El plan mantiene los descuentos en abonos y amplía las ayudas a jóvenes.', 65],
    ['espana', 'Aumenta la demanda de vivienda en alquiler en las grandes ciudades', 'Inmo ES', 'Los precios siguen al alza aunque con menor intensidad.', 58],
    ['mundo', 'Cumbre internacional acuerda nuevos compromisos climáticos', 'Mundo Hoy', 'Los países firmantes se comprometen a acelerar la transición energética.', 75],
    ['mundo', 'El comercio global se recupera con fuerza en el último trimestre', 'Global News', 'Los datos de exportaciones superan las previsiones de los analistas.', 48],
  ] as const;
  await db.newsArticle.createMany({
    data: news.map(([category, title, source, summary, importance], i) => ({
      userId: uid, category, title, source, summary, importance, url: `https://example.com/noticia/${i + 1}`,
      imageUrl: `https://picsum.photos/seed/ld${i + 1}/640/360`, publishedAt: new Date(now.getTime() - (i + 1) * 47 * 60_000),
    })),
  });

  // ── Finanzas
  const [checking, savings, shared] = await Promise.all([
    db.bankAccount.create({ data: { ownerId: uid, name: 'Cuenta corriente', kind: 'checking', openingBalance: 3200 } }),
    db.bankAccount.create({ data: { ownerId: uid, name: 'Cuenta ahorro', kind: 'savings', openingBalance: 14500 } }),
    db.bankAccount.create({ data: { ownerId: uid, householdId: household.id, name: 'Cuenta conjunta', kind: 'checking', openingBalance: 1800 } }),
  ]);
  const txs: { userId: string; accountId: string; date: Date; amount: number; category: string; description: string; merchant?: string; recurring?: boolean; upcoming?: boolean }[] = [];
  const add = (accountId: string, d: Date, amount: number, category: string, description: string, o: { merchant?: string; recurring?: boolean; upcoming?: boolean } = {}) =>
    txs.push({ userId: uid, accountId, date: d, amount: Math.round(amount * 100) / 100, category, description, ...o });
  const cats: [string, string[], number, number, number][] = [
    ['alimentacion', ['Mercadona', 'Carrefour', 'Frutería Pepe', 'Lidl'], 18, 70, 10],
    ['transporte', ['Gasolina', 'Metro', 'Parking', 'Taxi'], 8, 55, 6],
    ['ocio', ['Cine', 'Restaurante', 'Cervezas', 'Concierto'], 12, 60, 6],
    ['compras', ['Amazon', 'Decathlon', 'Zara'], 15, 90, 3],
  ];
  for (let m = 0; m < 7; m++) {
    const first = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const last = m === 0 ? now.getDate() : new Date(now.getFullYear(), now.getMonth() - m + 1, 0).getDate();
    const d = (n: number) => new Date(first.getFullYear(), first.getMonth(), Math.min(n, last), 10);
    if (m > 0 || now.getDate() >= 1) add(checking.id, d(1), 2650, 'ingresos', 'Nómina', { merchant: 'Empresa Demo', recurring: true });
    if (m > 0 || now.getDate() >= 5) add(shared.id, d(5), -780, 'vivienda', 'Hipoteca', { merchant: 'Banco Demo', recurring: true });
    if (m > 0 || now.getDate() >= 3) {
      add(checking.id, d(3), -120, 'vivienda', 'Luz y gas', { recurring: true });
      add(checking.id, d(10), -15.99, 'suscripciones', 'Netflix', { merchant: 'Netflix', recurring: true });
      add(checking.id, d(12), -10.99, 'suscripciones', 'Spotify', { merchant: 'Spotify', recurring: true });
      add(checking.id, d(15), -39.9, 'suscripciones', 'Gimnasio', { merchant: 'Gym Centro', recurring: true });
    }
    if (m > 0) add(savings.id, d(2), 400, 'ingresos', 'Aportación ahorro', { recurring: true });
    for (const [cat, merchants, lo, hi, count] of cats) {
      const n = m === 0 ? Math.max(1, Math.round((count * now.getDate()) / 30)) : count;
      for (let i = 0; i < n; i++) add(i % 3 === 0 ? shared.id : checking.id, d(1 + Math.floor(rnd() * 27)), -between(lo, hi), cat, merchants[Math.floor(rnd() * merchants.length)]!, { merchant: merchants[0] });
    }
    if (m === 1) add(checking.id, d(20), -450, 'viajes', 'Vuelos Lisboa', { merchant: 'Aerolínea Demo' });
    if (m === 0) add(checking.id, d(Math.max(1, now.getDate() - 2)), -310, 'ocio', 'Concierto + cena', { merchant: 'Ticketera' }); // gasto inusual
  }
  // Pagos próximos
  add(shared.id, day(1), -780, 'vivienda', 'Hipoteca (próximo cargo)', { recurring: true, upcoming: true });
  add(checking.id, day(2), -62, 'suscripciones', 'Seguro del móvil', { upcoming: true });
  add(checking.id, day(8), -310, 'transporte', 'Renovación seguro coche', { upcoming: true });
  // Cuenta propia de la pareja (privada, no la ve Alex) con algunos movimientos
  const samAcc = await db.bankAccount.create({ data: { ownerId: partner.id, name: 'Cuenta Sam', kind: 'checking', openingBalance: 2100 } });
  for (const [dayOff, amount, category, description] of [[-2, -45, 'alimentacion', 'Mercadona'], [-5, -19.9, 'ocio', 'Cine'], [-9, 1900, 'ingresos', 'Nómina']] as const)
    txs.push({ userId: partner.id, accountId: samAcc.id, date: day(dayOff, 10), amount, category, description });
  await db.transaction.createMany({ data: txs });
  await db.budget.createMany({
    data: [['vivienda', 950], ['alimentacion', 400], ['transporte', 150], ['ocio', 200], ['compras', 150], ['suscripciones', 80], ['viajes', 200], ['otros', 100]].map(([category, monthly]) => ({ userId: uid, category: category as string, monthly: monthly as number })),
  });

  // ── Inversiones
  const portfolio = await db.portfolio.create({ data: { userId: uid, name: 'Cartera principal' } });
  const invDefs: [string, string, string, number, number, number, number][] = [
    ['etf', 'VWCE', 'Vanguard FTSE All-World', 62, 105.2, 118.4, 1.6],
    ['etf', 'IWDA', 'iShares MSCI World', 40, 78.1, 89.7, 1.4],
    ['stock', 'AAPL', 'Apple', 15, 150.3, 189.2, 0.5],
    ['stock', 'ITX', 'Inditex', 50, 31.4, 46.8, 3.2],
    ['fund', 'IDX500', 'Fondo indexado S&P 500', 120, 24.6, 29.9, 0],
    ['crypto', 'BTC', 'Bitcoin', 0.08, 41000, 62500, 0],
    ['crypto', 'ETH', 'Ethereum', 0.9, 2100, 2650, 0],
  ];
  const investments = await db.investment.createManyAndReturn({
    data: invDefs.map(([assetType, symbol, name, quantity, avgCost, currentPrice, dividendYield]) => ({ portfolioId: portfolio.id, assetType, symbol, name, quantity, avgCost, currentPrice, dividendYield })),
  });
  // Dividendos cobrados (trimestrales/semestrales) en el último año
  const bySymbol = new Map(investments.map((i) => [i.symbol, i.id]));
  const monthsAgo = (m: number) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - m, 15, 12));
  await db.dividend.createMany({
    data: [
      ...[1, 4, 7, 10].map((m) => ({ investmentId: bySymbol.get('VWCE')!, date: monthsAgo(m), amount: 29.3 })),
      ...[2, 5, 8, 11].map((m) => ({ investmentId: bySymbol.get('IWDA')!, date: monthsAgo(m), amount: 12.5 })),
      ...[2, 5, 8, 11].map((m) => ({ investmentId: bySymbol.get('AAPL')!, date: monthsAgo(m), amount: 3.6 })),
      ...[3, 9].map((m) => ({ investmentId: bySymbol.get('ITX')!, date: monthsAgo(m), amount: 37.4 })),
    ],
  });
  // Evolución de la cartera: instantáneas semanales del último año (termina exactamente en el valor actual)
  const V0 = invDefs.reduce((a, [, , , q, , p]) => a + q * p, 0);
  const C0 = invDefs.reduce((a, [, , , q, c]) => a + q * c, 0);
  await db.portfolioSnapshot.createMany({
    data: Array.from({ length: 53 }, (_, i) => {
      const w = 52 - i; // semanas atrás
      const progress = 1 - w / 52;
      const noise = w === 0 ? 0 : (rnd() - 0.5) * 0.04;
      return {
        portfolioId: portfolio.id,
        date: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - w * 7, 12)),
        value: Math.round(V0 * (0.8 + 0.2 * progress + noise) * 100) / 100,
        cost: Math.round(C0 * (0.84 + 0.16 * progress) * 100) / 100,
      };
    }),
  });

  // ── Salud
  const metrics: { userId: string; kind: string; date: Date; value: number }[] = [];
  for (let i = 59; i >= 0; i--) {
    const d = day(-i);
    metrics.push({ userId: uid, kind: 'weight', date: d, value: Math.round((79.5 - (59 - i) * 0.04 + between(-0.3, 0.3)) * 10) / 10 });
    metrics.push({ userId: uid, kind: 'steps', date: d, value: Math.round(between(4500, 12500)) });
    metrics.push({ userId: uid, kind: 'sleep', date: d, value: Math.round(between(5.8, 8.2) * 10) / 10 });
  }
  await db.healthMetric.createMany({ data: metrics });
  const kinds = [['gym', 'Gimnasio: pierna', 60, 420], ['padel', 'Pádel', 90, 600], ['cardio', 'Carrera 5K', 35, 350], ['gym', 'Gimnasio: empuje', 55, 380]] as const;
  const wk: { userId: string; kind: string; title: string; date: Date; minutes: number; calories: number; planned: boolean }[] = [];
  for (let i = 1; i <= 40; i += 2) {
    const [kind, title, minutes, calories] = kinds[i % kinds.length]!;
    wk.push({ userId: uid, kind, title, date: day(-i, 19), minutes, calories, planned: false });
  }
  wk.push({ userId: uid, kind: 'gym', title: 'Gimnasio: espalda', date: day(0, 19), minutes: 60, calories: 400, planned: true });
  wk.push({ userId: uid, kind: 'padel', title: 'Pádel con Sam', date: day(2, 20), minutes: 90, calories: 600, planned: true });
  await db.workout.createMany({ data: wk });

  // ── Viajes
  const lisboa = await db.trip.create({
    data: { userId: uid, name: 'Escapada a Lisboa', destination: 'Lisboa, Portugal', startDate: day(27), endDate: day(30), budget: 900, notes: 'Probar pastéis de Belém',
      itinerary: [{ day: 1, plan: 'Llegada, Alfama y cena' }, { day: 2, plan: 'Belém y LX Factory' }, { day: 3, plan: 'Sintra' }, { day: 4, plan: 'Regreso' }] },
  });
  await db.travel.createMany({
    data: [
      { tripId: lisboa.id, kind: 'flight', title: 'Madrid → Lisboa', reference: 'XK29PL', startsAt: day(27, 8), endsAt: day(27, 9, 10), cost: 190 },
      { tripId: lisboa.id, kind: 'hotel', title: 'Hotel Alfama (3 noches)', reference: 'HA-4471', startsAt: day(27, 14), endsAt: day(30, 11), cost: 420 },
      { tripId: lisboa.id, kind: 'flight', title: 'Lisboa → Madrid', reference: 'XK30MD', startsAt: day(30, 18), endsAt: day(30, 19, 15), cost: 170 },
    ],
  });
  await db.trip.create({ data: { userId: uid, name: 'Verano en la costa', destination: 'Costa Brava', startDate: day(240), endDate: day(250), budget: 1800, itinerary: [] } });

  // ── Familia
  await db.familyMember.createMany({
    data: [
      { userId: uid, name: 'Sam', relation: 'Pareja', birthday: new Date(1991, now.getMonth() + 2, 14), color: '#ec4899' },
      { userId: uid, name: 'Mamá', relation: 'Madre', birthday: day(6), color: '#10b981' },
      { userId: uid, name: 'Lucía', relation: 'Sobrina', birthday: new Date(2018, now.getMonth() + 1, 3), color: '#f59e0b' },
    ],
  });

  // ── Notificaciones y automatizaciones
  await db.notification.createMany({
    data: [
      { userId: uid, type: 'email', title: 'Email importante de Ana García', body: 'Propuesta de contrato: necesito tu confirmación', href: '/email' },
      { userId: uid, type: 'task', title: 'Tarea atrasada', body: 'Declaración trimestral de impuestos', href: '/tasks' },
      { userId: uid, type: 'payment', title: 'Pago próximo mañana', body: 'Hipoteca · 780 €', href: '/finance' },
      { userId: uid, type: 'finance', title: 'Gasto inusual en ocio', body: 'Llevas más de lo habitual este mes', href: '/finance', read: true },
      { userId: uid, type: 'ai', title: 'Recomendación', body: 'Tienes hueco esta tarde: avanza con el esquema de base de datos', href: '/assistant' },
    ],
  });
  await db.automation.createMany({
    data: [
      { userId: uid, name: 'Email con fecha límite → tarea', triggerType: 'email_received', triggerConfig: { needsReply: true }, actionType: 'create_task', actionConfig: {}, requiresConfirmation: true },
      { userId: uid, name: 'Aviso 1 día antes de un pago', triggerType: 'date', triggerConfig: { daysBefore: 1 }, actionType: 'notify', actionConfig: {}, requiresConfirmation: false },
    ],
  });

  console.log(`Seed completado.\n  Usuario demo: ${DEMO_EMAIL}\n  Contraseña:   ${DEMO_PASSWORD}`);
  void partner;
}

main().then(() => db.$disconnect()).catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
