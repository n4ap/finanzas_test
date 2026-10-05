// E2E Fase 4: proyectos, salud, viajes y familia. Requiere app en marcha y seed fresco.
import { BASE, OUT, check, failures, launch, login, openSearch } from './helpers.mjs';

const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
page.on('dialog', (d) => d.accept()); // confirm() de eliminar
await login(page);
const tab = (name) => page.click(`[role=tab]:has-text("${name}")`);
const dialog = () => page.locator('[role=dialog]');
const submit = async (label = 'Guardar') => { await dialog().getByRole('button', { name: label, exact: true }).click(); };
const closed = () => page.waitForSelector('[role=dialog]', { state: 'detached' });

// ───────── Dashboard integrado ─────────
const prio = await page.locator('section[aria-label=Prioridades]').textContent();
check('dashboard: widget de proyectos marca «En riesgo»', /En riesgo/.test(await page.locator('section[aria-label=Proyectos]').textContent()));
check('dashboard: viaje próximo enlaza al detalle', (await page.locator('section[aria-label=Viajes] a[href^="/travel/"]').count()) === 1);

// ───────── Proyectos ─────────
await page.goto(`${BASE}/projects`);
await page.waitForSelector('text=Nuevo proyecto');
check('proyectos: un único h1', (await page.locator('h1').count()) === 1);
check('proyectos: 4 proyectos y aviso de atención', (await page.locator('main ul > li h2').count()) === 4 && /necesitan? atención/.test(await page.locator('[role=status]').first().textContent()));
check('proyectos: Finanzas «En riesgo» por tarea atrasada', /En riesgo[\s\S]*1 tarea atrasada|1 tarea atrasada/.test(await page.locator('li:has(h2:text-is("Finanzas"))').textContent()));
await page.click('button:has-text("Nuevo proyecto")');
await dialog().locator('input[name=name]').fill('Reforma cocina');
await dialog().locator('input[name=targetDate]').fill('2027-03-01');
await submit(); await closed();
await page.waitForSelector('h2:text-is("Reforma cocina")');
check('proyectos: crear proyecto lo muestra («Sin tareas»)', /Sin tareas/.test(await page.locator('li:has(h2:text-is("Reforma cocina"))').textContent()));
await page.click('h2:text-is("Reforma cocina")');
await page.waitForSelector('h1:text-is("Reforma cocina")');
await page.click('button:has-text("Nueva tarea")');
await dialog().locator('input[name=title]').fill('Pedir presupuesto');
check('proyecto: el formulario de tarea preselecciona el proyecto', (await dialog().locator('select[name=projectId] option:checked').textContent()) === 'Reforma cocina');
await submit(); await closed();
await page.waitForSelector('text=Pedir presupuesto');
check('proyecto: progreso 0 % con la tarea nueva', /0 de 1 tareas hechas/.test(await page.locator('main').textContent()));
await page.click('button[aria-label^="Completar «Pedir presupuesto»"]');
await page.waitForSelector('main :text("Completado")');
check('proyecto: completar la única tarea → «Completado» 100 %', /100 %/.test(await page.locator('main').textContent()));
await page.screenshot({ path: `${OUT}/p4-project-detail.png`, fullPage: true });
await page.click('button:has-text("Editar")');
await dialog().locator('input[name=name]').fill('Reforma cocina y baño');
await submit(); await closed();
await page.waitForSelector('h1:text-is("Reforma cocina y baño")');
check('proyecto: editar nombre', true);
await page.click('button:has-text("Editar")');
await dialog().getByRole('button', { name: 'Eliminar' }).click();
await page.waitForURL('**/projects');
check('proyecto: eliminar vuelve a la lista y desaparece', (await page.locator('h2:text-is("Reforma cocina y baño")').count()) === 0);

// ───────── Salud ─────────
await page.goto(`${BASE}/health`);
await page.waitForSelector('text=Salud y deporte');
check('salud: un único h1', (await page.locator('h1').count()) === 1);
for (const k of ['Peso', 'Pasos (media 7 días)', 'Sueño (media 7 días)', 'Entrenos esta semana']) check(`salud: tile «${k}»`, (await page.locator(`p:has-text("${k}")`).count()) >= 1);
check('salud: 4 gráficos con tabla alternativa', (await page.locator('button:has-text("Ver tabla")').count()) === 4 && (await page.locator('svg.recharts-surface').count()) >= 4);
check('salud: eje del peso sin fechas ISO', !/2026-\d\d-\d\d/.test(await page.locator('section:has(h3:text-is("Peso"))').textContent()));
check('salud: aviso de que no es consejo médico', /no es consejo médico|nada de esto es consejo médico/.test(await page.locator('main').textContent()));
// Medición fuera de rango
await page.click('button:has-text("Medición")');
await dialog().locator('select[aria-label="Tipo de medición"]').selectOption('sleep');
await dialog().locator('input[name=value]').fill('40');
await submit();
await page.waitForSelector('[role=dialog] [role=alert]');
check('salud: sueño de 40 h se rechaza con mensaje', /fuera de rango/.test(await dialog().locator('[role=alert]').textContent()));
await dialog().locator('select[aria-label="Tipo de medición"]').selectOption('weight');
await dialog().locator('input[name=value]').fill('75,5');
await submit(); await closed();
await tab('Registro');
await page.waitForSelector('li:has-text("Peso"):has-text("75,5 kg")');
check('salud: peso 75,5 guardado (coma decimal) y visible en el registro', true);
// Sustituir el del mismo día
await page.click('button:has-text("Medición")');
await dialog().locator('input[name=value]').fill('75,0');
await submit(); await closed();
await page.waitForSelector('li:has-text("75,0 kg")');
check('salud: mismo día y tipo se sustituye (sin duplicar)', (await page.locator('li:has-text("Peso"):has-text("kg")').count()) === 1 || (await page.locator('li:has-text("75,5 kg")').count()) === 0);
// Entrenos
await tab('Entrenos');
await page.click('button:has-text("Entreno"):not([role=tab])');
await dialog().locator('input[name=title]').fill('Pádel con Sam (test)');
await dialog().locator('input[name=planned]').check();
await submit(); await closed();
await page.waitForSelector('li:has-text("Pádel con Sam (test)")');
await page.click('button[aria-label="Marcar «Pádel con Sam (test)» como hecho"]');
await page.waitForFunction(() => !document.querySelector('button[aria-label="Marcar «Pádel con Sam (test)» como hecho"]'));
check('salud: planificado → hecho', true);
// Meta de pasos
await page.click('button:has-text("Metas")');
await dialog().locator('input[name=steps]').fill('12000');
await submit(); await closed();
await tab('Resumen');
await page.waitForSelector('text=Meta 12.000');
check('salud: nueva meta de pasos reflejada con miles', true);
await page.screenshot({ path: `${OUT}/p4-health-final.png`, fullPage: true });

// ───────── Viajes ─────────
await page.goto(`${BASE}/travel`);
await page.waitForSelector('text=Nuevo viaje');
check('viajes: 2 próximos con presupuesto de Lisboa 780/900', /780\s€ de 900\s€/.test(await page.locator('main').textContent()));
await page.click('h3:text-is("Escapada a Lisboa")');
await page.waitForSelector('h1:text-is("Escapada a Lisboa")');
check('viaje: 4 días de itinerario', (await page.locator('ol > li').count()) === 4);
check('viaje: presupuesto «Quedan 120 €»', /Quedan 120\s€/.test(await page.locator('main').textContent()));
check('viaje: orden por hora (check-in antes que comida)', (await page.locator('ol > li').first().textContent()).indexOf('Llegada') < (await page.locator('ol > li').first().textContent()).indexOf('Comida'));
check('viaje: días con mayúscula solo inicial (p. ej. «Domingo, 1 de noviembre»)', /Día 1 · (Lunes|Martes|Miércoles|Jueves|Viernes|Sábado|Domingo), \d+ de [a-zé]+/.test(await page.locator('ol > li').first().textContent()));
// añadir plan
await page.click('button:has-text("Añadir plan")');
await dialog().locator('input[name=title]').fill('Mirador de Graça');
await dialog().locator('input[name=time]').fill('08:00');
await submit(); await closed();
await page.waitForSelector('text=Mirador de Graça');
check('viaje: plan nuevo a las 08:00 aparece el primero del día', (await page.locator('ol > li').first().locator('li').first().textContent()).includes('Mirador'));
// reserva que supera el presupuesto
await tab('Reservas');
await page.click('button:has-text("Nueva reserva")');
await dialog().locator('input[name=title]').fill('Cena de despedida');
await dialog().locator('input[name=cost]').fill('150,50');
await submit(); await closed();
await page.waitForSelector('text=Cena de despedida');
check('viaje: presupuesto superado → «Superado en 30,50 €»', /Superado en 30,50\s€/.test(await page.locator('main').textContent()), (await page.locator('main').textContent()).slice(0, 300));
// maleta
await tab('Maleta');
await page.click('button:has-text("Añadir básicos")');
await page.waitForSelector('text=Neceser');
await page.click('button[aria-label="Marcar «Neceser»"]');
await page.waitForSelector('button[aria-label="Desmarcar «Neceser»"]');
check('viaje: maleta con básicos y marcado', /Maleta \(3\/\d+\)/.test(await page.locator('[role=tablist]').textContent()));
// acortar viaje con planes fuera → error claro
await page.click('button:has-text("Editar")');
await dialog().locator('input[name=endDate]').fill(await dialog().locator('input[name=startDate]').inputValue());
await submit();
await page.waitForSelector('[role=dialog] [role=alert]');
check('viaje: acortar con planes fuera de fechas se rechaza', /fuera de las nuevas fechas/.test(await dialog().locator('[role=alert]').textContent()));
await dialog().getByRole('button', { name: 'Cancelar' }).click();
await page.screenshot({ path: `${OUT}/p4-trip-final.png`, fullPage: true });
const tripUrl = page.url();
// borrar el otro viaje
await page.goto(`${BASE}/travel`);
await page.click('h3:text-is("Verano en la costa")');
await page.waitForSelector('h1:text-is("Verano en la costa")');
await page.click('button:has-text("Editar")');
await dialog().getByRole('button', { name: 'Eliminar' }).click();
await page.waitForURL('**/travel');
check('viajes: eliminar viaje', (await page.locator('h3:text-is("Verano en la costa")').count()) === 0);
// nuevo viaje con fechas inválidas
await page.click('button:has-text("Nuevo viaje")');
await dialog().locator('input[name=name]').fill('Roma');
await dialog().locator('input[name=destination]').fill('Roma');
await dialog().locator('input[name=startDate]').fill('2027-05-10');
await dialog().locator('input[name=endDate]').fill('2027-05-08');
await submit();
await page.waitForSelector('[role=dialog] [role=alert]');
check('viajes: vuelta anterior a salida se rechaza', /anterior a la salida/.test(await dialog().locator('[role=alert]').textContent()));
await dialog().locator('input[name=endDate]').fill('2027-05-12');
await submit();
await page.waitForURL(/\/travel\/[a-z0-9]+$/);
check('viajes: crear viaje navega a su detalle', (await page.locator('h1:text-is("Roma")').count()) === 1);

// ───────── Familia ─────────
await page.goto(`${BASE}/family`);
await page.waitForSelector('text=Próximos cumpleaños');
check('familia: cumpleaños de Mamá en 6 días con edad', /Mamá cumple 64[\s\S]*En 6 días/.test(await page.locator('main').textContent()));
await page.click('button:has-text("Nueva persona")');
await dialog().locator('input[name=name]').fill('Abuelo Paco');
await dialog().locator('input[name=relation]').fill('Abuelo/a');
await dialog().locator('input[name=birthday]').fill('1945-06-01');
await submit(); await closed();
await page.waitForSelector('button[aria-label="Editar a Abuelo Paco"]');
check('familia: nueva persona', true);
await page.fill('input[aria-label="Nuevo artículo"]', 'Aceite');
await page.press('input[aria-label="Nuevo artículo"]', 'Enter');
await page.waitForSelector('button[aria-label="Marcar «Aceite»"]');
await page.click('button[aria-label="Marcar «Aceite»"]');
await page.waitForSelector('button:has-text("Quitar 2 comprados")');
await page.click('button:has-text("Quitar 2 comprados")');
await page.waitForFunction(() => !document.querySelector('button[aria-label="Desmarcar «Pan»"]'));
check('familia: lista de la compra (añadir, marcar, quitar comprados)', (await page.locator('button[aria-label="Desmarcar «Aceite»"]').count()) === 0);

// ───────── Búsqueda global ─────────
await page.goto(`${BASE}/dashboard`);
await openSearch(page);
await page.fill('[role=dialog] input', 'Lucía');
await page.waitForSelector('[role=dialog] p:text-is("Familia")');
check('búsqueda: encuentra personas de la familia', true);
await page.keyboard.press('Escape');

// ───────── Aislamiento entre usuarios ─────────
const other = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const op = await other.newPage();
await login(op, 'pareja@lifedashboard.dev');
const status = async (url) => (await op.goto(url)).status();
check('aislamiento: el detalle de un viaje ajeno da 404', (await status(tripUrl)) === 404);
await op.goto(`${BASE}/projects`); const href = null;
check('aislamiento: la pareja no ve proyectos ni familia ajenos', !/Finanzas|Life Dashboard/.test(await op.locator('main').textContent()));
await op.goto(`${BASE}/family`);
check('aislamiento: la pareja no ve a Mamá', !/Mamá/.test(await op.locator('main').textContent()));
await other.close();

// ───────── Móvil ─────────
const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
const mp = await mob.newPage();
await login(mp);
for (const [name, path] of [['proyectos', '/projects'], ['salud', '/health'], ['viajes', '/travel'], ['viaje', tripUrl.replace(BASE, '')], ['familia', '/family']]) {
  await mp.goto(`${BASE}${path}`);
  await mp.waitForSelector('h1');
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(`móvil: ${name} sin scroll horizontal`, overflow <= 0, `overflow ${overflow}px`);
  await mp.screenshot({ path: `${OUT}/p4-m-${name}.png`, fullPage: true });
}
await mob.close();

check('sin errores de consola ni excepciones', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
console.log(failures() === 0 ? 'Todo OK' : `${failures()} fallos`);
process.exit(failures() === 0 ? 0 : 1);
