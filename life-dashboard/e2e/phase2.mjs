// E2E Fase 2: tareas, calendario, email y noticias. Requiere app en marcha y seed fresco (npm run db:reset).
import { BASE, OUT, check, failures, launch, login } from './helpers.mjs';

const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
await login(page);

// Cada página tiene exactamente un h1 (accesibilidad)
for (const path of ['dashboard', 'tasks', 'calendar', 'email', 'news', 'focus']) {
  await page.goto(`${BASE}/${path}`);
  await page.waitForSelector('main');
  check(`a11y: /${path} tiene un único h1`, (await page.locator('h1').count()) === 1);
}

// ───────── TAREAS ─────────
await page.goto(`${BASE}/tasks`);
await page.waitForSelector('text=Declaración trimestral de impuestos');
check('tareas: lista agrupada por estado', (await page.locator('section[aria-label="En progreso"]').count()) === 1);
check('tareas: marca la atrasada', (await page.textContent('body')).includes('atrasada'));

await page.click('button:has-text("Nueva tarea")');
await page.fill('input[name=title]', 'Tarea E2E recurrente');
await page.selectOption('select[name=status]', 'next');
await page.fill('input[name=dueDate]', '2026-10-20');
await page.selectOption('select[name=recurrence]', 'weekly');
await page.fill('input[name=tags]', 'e2e, prueba');
await page.click('button[type=submit]:has-text("Guardar")');
await page.waitForSelector('text=Tarea E2E recurrente');
check('tareas: crear con fecha, etiquetas y recurrencia', (await page.locator('li:has-text("Tarea E2E recurrente")').first().textContent()).includes('#e2e'));

await page.click('button[aria-label="Completar «Tarea E2E recurrente»"]');
await page.waitForTimeout(1200);
await page.check('text=Mostrar completadas');
const rows = await page.locator('li:has-text("Tarea E2E recurrente")').count();
check('tareas: completar una recurrente crea la siguiente ocurrencia (27 oct)', rows >= 2 && (await page.textContent('body')).includes('27 oct'), `filas=${rows}`);

await page.click('button:has-text("Añadir subtarea a «Diseñar esquema de base de datos»"), button[aria-label="Añadir subtarea a «Diseñar esquema de base de datos»"]');
await page.fill('input[name=title]', 'Subtarea E2E');
await page.click('button[type=submit]:has-text("Guardar")');
await page.waitForSelector('text=Subtarea E2E');
check('tareas: subtareas anidadas (contador 0/3)', await page.getByText('0/3 subtareas').first().isVisible());

await page.click('[role=tab]:has-text("Kanban")');
await page.waitForSelector('section[aria-label="Inbox"]');
await page.selectOption('select[aria-label="Mover «Probar modelos locales con Ollama»"]', 'next');
await page.waitForTimeout(1200);
check('kanban: mover entre columnas', (await page.locator('section[aria-label="Próxima"]').textContent()).includes('Probar modelos locales con Ollama'));
// Drag & drop real
// Arrastre con movimientos graduales (como una persona): dragTo() es demasiado brusco para el re-render de React.
const box = await page.locator('li[draggable=true]:has-text("Escribir prompt del asistente semanal")').boundingBox();
const tgt = await page.locator('section[aria-label="En progreso"]').boundingBox();
await page.mouse.move(box.x + 10, box.y + 10);
await page.mouse.down();
await page.mouse.move(box.x + 30, box.y + 30, { steps: 5 });
await page.mouse.move(tgt.x + tgt.width / 2, tgt.y + 40, { steps: 15 });
await page.mouse.up();
await page.waitForTimeout(1200);
check('kanban: arrastrar y soltar', (await page.locator('section[aria-label="En progreso"]').textContent()).includes('Escribir prompt del asistente semanal'));
await page.screenshot({ path: `${OUT}/tasks-kanban.png` });

await page.click('[role=tab]:has-text("Calendario")');
check('tareas: vista calendario con tareas por fecha', (await page.locator('.grid-cols-7 button:has-text("Llamar al seguro del coche")').count()) >= 1);

await page.click('[role=tab]:has-text("Lista")');
await page.click('button:has-text("Tarea E2E recurrente") >> nth=0');
page.once('dialog', (d) => d.accept());
await page.click('button:has-text("Eliminar")');
await page.waitForTimeout(1000);
check('tareas: eliminar', (await page.locator('li:has-text("Tarea E2E recurrente")').count()) <= 1);

// ───────── CALENDARIO ─────────
await page.goto(`${BASE}/calendar`);
await page.waitForSelector('[role=tab][aria-selected=true]:has-text("Semana")');
await page.click('button:has-text("Nuevo evento") >> nth=0');
await page.fill('input[name=title]', 'Evento E2E');
await page.fill('input[name=location]', 'Sala E2E');
await page.fill('input[name=attendees]', 'a@x.test, b@x.test');
await page.click('button[type=submit]:has-text("Guardar")');
await page.waitForSelector('button:has-text("Evento E2E")');
check('calendario: crear evento', true);

await page.click('[role=tab]:has-text("Agenda")');
check('calendario: agenda muestra ubicación y participantes', await page.locator('li:has-text("Evento E2E"):has-text("Sala E2E")').first().isVisible());
await page.fill('input[aria-label="Buscar eventos"]', 'pádel');
check('calendario: búsqueda', await page.locator('text=Pádel con Sam').first().isVisible() && (await page.locator('text=Evento E2E').count()) === 0);
await page.fill('input[aria-label="Buscar eventos"]', '');

await page.click('[role=tab]:has-text("Mes")');
check('calendario: vista mes', (await page.locator('.grid-cols-7 button:has-text("Evento E2E")').count()) >= 1);
await page.screenshot({ path: `${OUT}/calendar-month.png` });
await page.click('.grid-cols-7 button:has-text("Evento E2E") >> nth=0');
await page.fill('input[name=title]', 'Evento E2E editado');
await page.click('button[type=submit]:has-text("Guardar")');
await page.waitForSelector('.grid-cols-7 button:has-text("Evento E2E editado")');
check('calendario: editar evento', true);

await page.click('[role=tab]:has-text("Semana")');
check('calendario: la pestaña activa coincide con la vista', (await page.locator('[role=tab][aria-selected=true]').textContent()) === 'Semana' && (await page.locator('main h1').first().textContent()).includes('–'));
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/calendar-week.png` });
// Calendarios múltiples: ocultar «Trabajo»
await page.uncheck('label:has-text("Trabajo") input');
check('calendario: ocultar un calendario filtra sus eventos', (await page.locator('button:has-text("Reunión de producto")').count()) === 0);
await page.check('label:has-text("Trabajo") input');

await page.click('[role=tab]:has-text("Mes")');
await page.click('.grid-cols-7 button:has-text("Evento E2E editado") >> nth=0');
page.once('dialog', (d) => d.accept());
await page.click('button:has-text("Eliminar")');
await page.waitForTimeout(1000);
check('calendario: eliminar evento', (await page.locator('button:has-text("Evento E2E editado")').count()) === 0);

// Navegar fuera de la ventana precargada recarga datos sin romperse
await page.click('[role=tab]:has-text("Agenda")');
for (let i = 0; i < 4; i++) await page.click('button[aria-label=Siguiente]');
await page.waitForTimeout(1200);
check('calendario: navegar lejos no falla', await page.locator('main h1').first().isVisible());

// ───────── EMAIL ─────────
await page.goto(`${BASE}/email`);
await page.waitForSelector('text=Propuesta de contrato');
check('email: carpetas', (await page.locator('nav[aria-label=Carpetas] button').count()) === 5);
await page.click('nav[aria-label=Carpetas] button:has-text("No leídos")');
const unreadBefore = await page.locator('section[aria-label="Lista de emails"] li').count();
await page.click('nav[aria-label=Carpetas] button:has-text("Bandeja")');
await page.click('section[aria-label="Lista de emails"] button:has-text("Propuesta de contrato")');
await page.waitForSelector('section[aria-label="Detalle del email"] h2');
await page.waitForTimeout(1200);
await page.click('nav[aria-label=Carpetas] button:has-text("No leídos")');
check('email: abrir marca como leído', (await page.locator('section[aria-label="Lista de emails"] li').count()) === unreadBefore - 1);
await page.click('nav[aria-label=Carpetas] button:has-text("Bandeja")');
await page.click('section[aria-label="Lista de emails"] button:has-text("Propuesta de contrato")');
await page.locator('section[aria-label="Detalle del email"]').getByRole('button', { name: /analizar/i }).click();
await page.locator('section[aria-label="Detalle del email"]').getByText(/Fecha límite/).waitFor();
const det = await page.locator('section[aria-label="Detalle del email"]').textContent();
check('email: resumen con fecha límite y categoría', det.includes('Fecha límite') && det.includes('trabajo'));
await page.click('button:has-text("Redactar borrador")');
await page.waitForSelector('textarea[aria-label="Texto del borrador"]');
check('email: borrador generado para revisar', (await page.inputValue('textarea[aria-label="Texto del borrador"]')).startsWith('Hola Ana'));
check('email: NO hay botón de enviar (solo borrador/mailto)', (await page.locator('button:has-text("Enviar"), a:has-text("Enviar")').count()) === 0 && (await page.locator('a[href^="mailto:"]').count()) === 1);
await page.click('button:has-text("Extraer tareas")');
await page.waitForSelector('text=Tareas detectadas');
await page.click('button:has-text("Añadir") >> nth=0');
await page.waitForSelector('text=Tarea creada');
await page.goto(`${BASE}/tasks`);
check('email: tarea creada desde email aparece en Tareas', (await page.textContent('body')).includes('confirmación'));
await page.goto(`${BASE}/email`);
await page.click('nav[aria-label=Carpetas] button:has-text("Enviados")');
check('email: carpeta Enviados muestra destinatarios reales', (await page.locator('section[aria-label="Lista de emails"] li').count()) === 2 && (await page.textContent('section[aria-label="Lista de emails"]')).includes('Para: luis@empresa.test'));
await page.screenshot({ path: `${OUT}/email.png` });

// ───────── NOTICIAS ─────────
await page.goto(`${BASE}/news`);
await page.waitForSelector('section[aria-label="Lo importante de hoy"]');
const topN = await page.locator('section[aria-label="Lo importante de hoy"] ol > li').count();
check('noticias: «Lo importante de hoy» máximo 5', topN > 0 && topN <= 5, `n=${topN}`);
await page.click('[role=tab]:has-text("Deportes")');
const cats = await page.locator('section[aria-label="Por categoría"] ul li').allTextContents();
check('noticias: filtro por categoría', cats.length > 0 && cats.every((t) => t.includes('Deportes')));
await page.click('button[aria-pressed]:has-text("Finanzas")');
await page.waitForTimeout(1000);
await page.reload();
check('noticias: categorías priorizadas persisten', (await page.locator('button[aria-pressed=true]:has-text("Finanzas")').count()) === 1);
await page.screenshot({ path: `${OUT}/news.png`, fullPage: true });
await page.goto(`${BASE}/dashboard`);
check('dashboard refleja el nuevo ranking de noticias (≤5)', (await page.locator('section[aria-label="Lo importante de hoy"] li').count()) <= 5);

// Búsqueda global sigue funcionando con datos nuevos
await page.keyboard.press('Control+k');
await page.waitForSelector('[role=dialog] input:focus');
await page.keyboard.type('Pádel');
await page.waitForSelector('[role=dialog] >> text=Eventos');
check('búsqueda global encuentra eventos', true);
await page.keyboard.press('Escape');

// ───────── Aislamiento entre usuarios ─────────
const other = await browser.newContext();
const op = await other.newPage();
await login(op, 'pareja@lifedashboard.dev');
await op.goto(`${BASE}/tasks`);
await op.waitForSelector('text=Sin tareas');
check('aislamiento: otro usuario no ve mis tareas', (await op.textContent('body')).includes('Sin tareas') && !(await op.textContent('body')).includes('impuestos'));
const r = await op.request.get(`${BASE}/api/search?q=contrato`);
check('aislamiento: la búsqueda global no filtra datos ajenos', (await r.json()).hits.length === 0);

check('sin errores JS en consola', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
console.log(failures() ? `\n${failures()} comprobaciones fallidas` : '\nTodo OK');
process.exit(failures() ? 1 : 0);
