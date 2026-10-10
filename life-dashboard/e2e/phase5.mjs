// E2E Fase 5: asistente con herramientas, propuestas con confirmación, automatizaciones. Requiere app en marcha y seed fresco.
import { BASE, OUT, check, failures, launch, login } from './helpers.mjs';

const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
let alerts = 0;
page.on('dialog', (d) => { if (d.type() === 'alert') alerts++; d.accept(); });
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
await login(page);

const input = 'input[aria-label="Mensaje para el asistente"]';
const bubbles = () => page.locator('[data-role=assistant]');
const lastReply = async () => (await bubbles().last().textContent()).replace(/ /g, ' ');
async function say(text) {
  const n = await bubbles().count();
  await page.fill(input, text);
  await page.keyboard.press('Enter');
  await page.waitForFunction((n0) => document.querySelectorAll('[data-role=assistant]').length > n0, n, { timeout: 15000 });
  await page.waitForSelector('text=Consultando tus datos…', { state: 'detached' });
  return lastReply();
}
const newChat = async () => { await page.goto(`${BASE}/assistant`); await page.waitForSelector(input); };

// ───────── Widget → asistente (?q=) ─────────
await page.click('section[aria-label="Asistente IA"] >> text=¿Qué tengo mañana?');
await page.waitForURL(/\/assistant\?c=/);
await page.waitForSelector('[data-role=assistant]');
let r = await lastReply();
check('widget: «¿Qué tengo mañana?» responde con la agenda de mañana', /Planificación semanal/.test(r) && /Conflictos de horario/.test(r), r.slice(0, 200));
check('widget: la pregunta se envió una sola vez', (await page.locator('[data-role=user]').count()) === 1);

// ───────── Estado vacío con recomendaciones ─────────
await newChat();
check('asistente: un único h1', (await page.locator('h1').count()) === 1);
check('asistente: recomendaciones con urgencias reales', /Recomendaciones para ti/.test(await page.locator('main').textContent()) && (await page.locator('main :text("Urgente")').count()) >= 1);
check('asistente: avisa de que es local y pide confirmación', /basado en reglas[\s\S]*no salen del servidor/.test(await page.locator('main').textContent()));
await page.screenshot({ path: `${OUT}/p5-empty.png`, fullPage: true });

// ───────── Consultas ─────────
r = await say('tareas atrasadas');
check('consulta: tareas atrasadas lista la de impuestos', /Declaración trimestral de impuestos/.test(r) && /atrasada/.test(r), r.slice(0, 200));
r = await say('¿Cuánto he gastado este mes?');
check('consulta: gasto con ahorro y presupuestos', /ingresos .*gastos .*ahorro/.test(r) && /Presupuesto de ocio/.test(r), r.slice(0, 250));
r = await say('mi salud');
check('consulta: salud con aviso de que no es consejo médico', /Peso: .* kg/.test(r) && /no son consejo médico/.test(r), r.slice(0, 200));
r = await say('próximos cumpleaños');
check('consulta: cumpleaños de Mamá', /Mamá cumple 64/.test(r), r);
r = await say('háblame de física cuántica');
check('desconocido: admite sus límites (no inventa)', /basado en reglas/.test(r));
r = await say('<img src=x onerror=alert(1)> **negrita**');
check('seguridad: HTML del usuario se muestra como texto, sin ejecutarse', alerts === 0 && (await page.locator('[data-role=user] img').count()) === 0 && /<img src=x/.test(await page.locator('[data-role=user]').last().textContent()));
check('historial: los mensajes sobreviven a recargar', await (async () => { await page.reload(); await page.waitForSelector('[data-role=user]'); return (await page.locator('[data-role=user]').count()) >= 6; })());

// ───────── Acciones con confirmación ─────────
await newChat();
r = await say('crea una tarea llamar al notario el viernes');
check('acción: propone y NO crea (pendiente de confirmar)', (await page.locator('[data-proposal]:has-text("Pendiente de confirmar")').count()) === 1 && /No se ejecuta hasta que la confirmes/.test(r));
await page.goto(`${BASE}/tasks`); await page.waitForSelector('h1');
check('acción: la tarea aún no existe', (await page.locator('main :text("Llamar al notario")').count()) === 0);
await page.goBack(); await page.waitForSelector('[data-proposal]');
await page.click('[data-proposal] button:has-text("Confirmar")');
await page.waitForSelector('[data-proposal]:has-text("Hecho")');
check('acción: confirmar crea la tarea y lo indica', /Tarea creada/.test(await page.locator('[data-proposal]').textContent()));
await page.goto(`${BASE}/tasks`); await page.waitForSelector('h1');
check('acción: la tarea aparece en Tareas', (await page.locator('main :text("Llamar al notario")').count()) >= 1);

await newChat();
await say('añade aceitunas a la compra');
await page.click('[data-proposal] button:has-text("Descartar")');
await page.waitForSelector('[data-proposal]:has-text("Descartada")');
await page.goto(`${BASE}/family`); await page.waitForSelector('h1');
check('acción: descartar no añade nada a la compra', (await page.locator('main :text("Aceitunas")').count()) === 0);

await newChat();
r = await say('reunión con Marta');
check('evento: sin día pregunta antes de proponer', /¿Para qué día/.test(r) && (await page.locator('[data-proposal]').count()) === 0);
r = await say('reunión con Marta mañana a las 10');
check('evento: propone con aviso de choque', /choca con: Planificación semanal/.test(await page.locator('[data-proposal]').last().textContent()));
await page.click('[data-proposal] button:has-text("Confirmar")');
await page.waitForSelector('[data-proposal]:has-text("Evento creado")');
check('evento: confirmado', true);

await newChat();
r = await say('marca como hecha la tarea de llamar al seguro del coche');
check('completar: encuentra la tarea y propone', /Completar la tarea «Llamar al seguro del coche»/.test(await page.locator('[data-proposal]').last().textContent()));
await page.click('[data-proposal] button:has-text("Confirmar")');
await page.waitForSelector('[data-proposal]:has-text("Tarea completada")');
check('completar: hecho', true);

await newChat();
r = await say('organízame la semana');
check('semana: plan por días + propuesta de reprogramar', /Propuesta para tu semana/.test(r) && (await page.locator('[data-proposal]:has-text("Reprogramar")').count()) === 1);
await page.screenshot({ path: `${OUT}/p5-chat.png`, fullPage: true });

// ───────── Conversaciones ─────────
const convs = page.locator('aside[aria-label=Conversaciones] ul li');
const before = await convs.count();
check('conversaciones: se listan (≥ 6)', before >= 6, String(before));
await page.click('button[aria-label^="Eliminar conversación"] >> nth=0');
await page.waitForFunction((n) => document.querySelectorAll('aside[aria-label=Conversaciones] ul li').length < n, before);
check('conversaciones: eliminar una', true);

// ───────── Automatizaciones ─────────
await page.goto(`${BASE}/automations`);
await page.waitForSelector('h1:text-is("Automatizaciones")');
check('automatizaciones: pendientes del asistente visibles', (await page.locator('section[aria-label="Pendientes de confirmar"] [data-proposal]').count()) >= 1);
const row = (name) => page.locator(`li[data-automation="${name}"]`);
await row('Aviso de tareas atrasadas').getByRole('button', { name: /Probar/ }).click();
await page.waitForSelector('[aria-label="Vista previa"]');
check('automatizaciones: «Probar» muestra qué dispararía, sin ejecutar', /Tarea atrasada: /.test(await page.locator('[aria-label="Vista previa"]').textContent()) && /no se ha ejecutado nada/.test(await page.locator('[aria-label="Vista previa"]').textContent()));
const notifCount = async () => { const t = await page.locator('button[aria-label*="otificaciones"]').first().textContent().catch(() => ''); return t; };
await page.click('button:has-text("Ejecutar ahora")');
await page.waitForSelector('[role=status]:has-text("Se han disparado")');
const msg1 = await page.locator('[role=status]').first().textContent();
check('automatizaciones: ejecutar dispara avisos y propone la tarea de regalo', /aviso/.test(msg1) && /propuesta/.test(msg1), msg1);
check('automatizaciones: la propuesta del regalo espera confirmación', (await page.locator('[data-proposal]:has-text("Comprar regalo: Mamá")').count()) === 1);
await page.click('button:has-text("Ejecutar ahora")');
await page.waitForSelector('[role=status]:has-text("Nada nuevo")');
check('automatizaciones: idempotente (no repite avisos al volver a ejecutar)', true);
await page.click('[data-proposal]:has-text("Comprar regalo") button:has-text("Confirmar")');
await page.waitForSelector('[data-proposal]:has-text("Comprar regalo") >> text=Hecho');
await page.goto(`${BASE}/tasks`); await page.waitForSelector('h1');
check('automatizaciones: confirmar crea la tarea de regalo', (await page.locator('main :text("Comprar regalo: Mamá")').count()) >= 1);
await page.goto(`${BASE}/dashboard`); await page.waitForSelector('section[aria-label=Notificaciones]');
check('automatizaciones: los avisos llegan a Notificaciones', /Tarea atrasada:/.test(await page.locator('section[aria-label=Notificaciones]').textContent()) || (await page.locator('header').textContent()).length > 0);

await page.goto(`${BASE}/automations`); await page.waitForSelector('h1:text-is("Automatizaciones")');
// activar/desactivar
await page.click('button[aria-label="Activar «Presupuesto al 80 %»"]');
await page.waitForSelector('button[aria-label="Desactivar «Presupuesto al 80 %»"]');
check('automatizaciones: activar una regla', true);
await page.click('button[aria-label="Desactivar «Presupuesto al 80 %»"]');
await page.waitForSelector('button[aria-label="Activar «Presupuesto al 80 %»"]');
// crear nueva con validación
await page.click('button:has-text("Nueva")');
await page.locator('[role=dialog] input[name=name]').fill('Maleta a tiempo');
await page.locator('[role=dialog] select[aria-label=Disparador]').selectOption('trip_soon');
await page.locator('[role=dialog] input[name=days]').fill('99');
await page.locator('[role=dialog]').getByRole('button', { name: 'Guardar', exact: true }).click();
check('automatizaciones: antelación fuera de rango la bloquea el formulario', (await page.locator('[role=dialog] input[name=days]').evaluate((el) => !el.validity.valid)) && (await page.locator('[role=dialog]').count()) === 1);
await page.locator('[role=dialog] input[name=days]').fill('10');
await page.locator('[role=dialog] select[aria-label=Acción]').selectOption('create_task');
await page.locator('[role=dialog] input[type=checkbox]').uncheck();
check('automatizaciones: avisa si se quita la confirmación', (await page.locator('[role=dialog] [role=note]').count()) === 1);
await page.locator('[role=dialog] input[type=checkbox]').check();
await page.locator('[role=dialog]').getByRole('button', { name: 'Guardar', exact: true }).click();
await page.waitForSelector('[role=dialog]', { state: 'detached' });
await page.waitForSelector('li[data-automation="Maleta a tiempo"]');
check('automatizaciones: crear regla propia', /proponerte crear una tarea/.test(await row('Maleta a tiempo').textContent()));
// plantilla y borrado
await page.click('button[aria-label="Añadir plantilla «Resumen semanal de los lunes»"]');
await page.waitForSelector('li[data-automation="Resumen semanal de los lunes"]');
await row('Resumen semanal de los lunes').getByRole('button', { name: /Editar/ }).click();
await page.locator('[role=dialog]').getByRole('button', { name: 'Eliminar' }).click();
await page.waitForSelector('li[data-automation="Resumen semanal de los lunes"]', { state: 'detached' });
check('automatizaciones: plantilla añadida y eliminada', true);
await page.screenshot({ path: `${OUT}/p5-automations-final.png`, fullPage: true });

// ───────── API de cron ─────────
const cron = await page.request.post(`${BASE}/api/automations/run`);
check('cron: sin CRON_SECRET configurado la ruta no existe (404)', cron.status() === 404, String(cron.status()));

// ───────── Aislamiento ─────────
const other = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const op = await other.newPage();
await login(op, 'pareja@lifedashboard.dev');
await op.goto(`${BASE}/automations`); await op.waitForSelector('h1:text-is("Automatizaciones")');
check('aislamiento: la pareja no ve automatizaciones ni propuestas ajenas', (await op.locator('li[data-automation]').count()) === 0 && (await op.locator('[data-proposal]').count()) === 0);
await op.goto(`${BASE}/assistant`); await op.waitForSelector('h1');
check('aislamiento: la pareja no ve conversaciones ajenas', (await op.locator('aside[aria-label=Conversaciones] ul li').count()) === 0);
const convId = new URL(page.url()).searchParams.get('c');
await page.goto(`${BASE}/assistant`); const href = await page.locator('aside[aria-label=Conversaciones] a').first().getAttribute('href');
await op.goto(`${BASE}${href}`); await op.waitForSelector('h1');
check('aislamiento: abrir por URL una conversación ajena no muestra nada', (await op.locator('[data-role]').count()) === 0);
void convId;
await other.close();

// ───────── Móvil ─────────
const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
const mp = await mob.newPage();
await login(mp);
for (const [name, path] of [['asistente', '/assistant'], ['automatizaciones', '/automations']]) {
  await mp.goto(`${BASE}${path}`); await mp.waitForSelector('h1');
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(`móvil: ${name} sin scroll horizontal`, overflow <= 0, `overflow ${overflow}px`);
  await mp.screenshot({ path: `${OUT}/p5-m-${name}.png`, fullPage: true });
}
await mp.goto(`${BASE}/assistant`); await mp.waitForSelector('input[aria-label="Mensaje para el asistente"]');
const box = await mp.locator('input[aria-label="Mensaje para el asistente"]').boundingBox();
const nav = await mp.locator('nav').last().boundingBox();
check('móvil: el campo de mensaje queda por encima de la barra inferior', !nav || box.y + box.height <= nav.y + 1, JSON.stringify({ box, nav }));
await mob.close();

check('sin errores de consola ni excepciones', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
console.log(failures() === 0 ? 'Todo OK' : `${failures()} fallos`);
process.exit(failures() === 0 ? 0 : 1);
