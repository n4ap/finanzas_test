// E2E Fase 7: coach personal (entrevista, mapa de vida, objetivos, revisiones, decisiones, panel y asistente). Requiere app en marcha y seed fresco.
import { BASE, OUT, check, failures, launch, login } from './helpers.mjs';

const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
page.on('dialog', (d) => d.accept());
await login(page);
const tab = (name) => page.click(`[role=tablist][aria-label="Sección del coach"] [role=tab]:has-text("${name}")`);
const dialog = () => page.locator('[role=dialog]');
const closed = () => page.waitForSelector('[role=dialog]', { state: 'detached' });

// ───────── Entrada: sin respuestas abre la entrevista ─────────
check('menú: enlace «Coach»', (await page.locator('nav a[href="/coach"]').count()) >= 1);
await page.goto(`${BASE}/coach`);
await page.waitForSelector('h1:text-is("Coach")');
check('coach: un único h1', (await page.locator('h1').count()) === 1);
check('coach: sin respuestas abre «Mapa de vida» en el bloque 1', (await page.locator('[role=tab][aria-selected=true]:has-text("Mapa de vida")').count()) === 1 && (await page.locator('h2:text-is("Tu situación actual")').count()) === 1);
check('coach: 8 bloques en la entrevista', (await page.locator('ol > li button[aria-current], ol > li button').filter({ hasText: /\d+\/\d+$/ }).count()) === 8);

await page.fill('textarea[name=s_situacion]', '38 años, vivo con mi pareja, mecánico de aviones');
await page.fill('textarea[name=s_satisfaccion]', '6: me falta tiempo para entrenar');
await page.fill('textarea[name=s_energia]', 'Los turnos de noche');
await page.click('button:has-text("Guardar y seguir")');
await page.waitForSelector('h2:text-is("Lo que más quieres cambiar")');
check('entrevista: guardar el bloque 1 pasa al bloque 2', true);
check('entrevista: el bloque 1 queda marcado como hecho (3/6)', await page.locator('ol > li').first().filter({ hasText: '3/6' }).waitFor({ timeout: 10000 }).then(() => true, () => false));
await page.fill('textarea[name=c_una]', 'Entrenar 3 días por semana');
await page.click('button:has-text("Guardar y seguir")');
await page.waitForSelector('h2:text-is("Tus objetivos principales")');
await page.click('button:has-text("Mi mapa de vida")');
await page.waitForSelector('h2:has-text("Mapa personal de vida")');
const map = await page.locator('main').textContent();
check('mapa de vida: agrupa respuestas por área', /Personal[\s\S]*mecánico de aviones/.test(map) && /Salud emocional[\s\S]*turnos de noche/.test(map));
await page.screenshot({ path: `${OUT}/p7-mapa.png`, fullPage: true });

// ───────── Objetivos ─────────
await tab('Objetivos');
await page.waitForSelector('h2:text-is("90 días")');
await page.locator('section:has(h2:text-is("90 días")) button:has-text("Añadir")').click();
await dialog().locator('input[name=title]').fill('Entrenar 3 días por semana durante 12 semanas');
await dialog().locator('input[name=metric]').fill('Sesiones por semana');
await dialog().locator('input[name=baseline]').fill('1');
await dialog().locator('input[name=target]').fill('3');
await dialog().locator('input[name=nextAction]').fill('Lunes 18:00: fuerza 45 min');
await dialog().getByRole('button', { name: 'Guardar', exact: true }).click();
await closed();
const card = page.locator('section:has(h2:text-is("90 días")) h3:text-is("Entrenar 3 días por semana durante 12 semanas")');
await card.waitFor();
check('objetivos: crear objetivo de 90 días con métrica y próxima acción', /Sesiones por semana · 1 → 3/.test(await page.locator('main').textContent()));
check('objetivos: contador de foco 1/3', /1\/3/.test(await page.locator('section:has(h2:text-is("90 días"))').textContent()));
await page.click('button:has-text("+25 %")');
check('objetivos: +25 % actualiza el progreso', await page.waitForSelector('[role=progressbar][aria-valuenow="25"]', { timeout: 10000 }).then(() => true, () => false));
await page.click('button:has-text("Crear tarea")');
await page.waitForSelector('[role=status]:has-text("Tarea creada")');
check('objetivos: la próxima acción se convierte en tarea', true);
await page.screenshot({ path: `${OUT}/p7-objetivos.png`, fullPage: true });

// ───────── Revisiones ─────────
await tab('Revisiones');
await page.waitForSelector('h2:text-is("Revisión de hoy")');
await page.locator('input[type=range][aria-label="😊 Ánimo"]').fill('7');
await page.fill('textarea[name=logros]', 'Entrené fuerza');
await page.fill('textarea[name=manana]', 'Preparar la revisión del motor');
await page.click('button:has-text("Guardar revisión")');
await page.waitForSelector('[role=status]:has-text("prioridad añadida")');
check('revisión diaria: se guarda y la prioridad de mañana pasa a tareas', true);
check('revisión diaria: aparece en «Últimos días» con el ánimo', /7/.test(await page.locator('table').first().textContent()));
await page.click('[role=tablist][aria-label="Tipo de revisión"] [role=tab]:has-text("Semanal")');
await page.waitForSelector('h2:has-text("Revisión semanal")');
await page.locator('input[type=range][aria-label="🏋️ Salud física"]').fill('8');
await page.locator('input[type=range][aria-label="❤️ Relaciones"]').fill('4');
await page.locator('input[type=range][aria-label="😴 Descanso"]').click(); // el punto medio (5) también se puede elegir con un clic
check('revisión semanal: un clic en el punto medio puntúa 5', /5\/10/.test(await page.locator('label:has(input[aria-label="😴 Descanso"])').textContent()));
await page.fill('textarea[name=prioridad]', 'Dormir 7 h');
await page.click('button:has-text("Guardar revisión semanal")');
await page.waitForSelector('[role=status]:has-text("Revisión semanal guardada")');
await page.waitForSelector('table:has-text("Salud física")');
const trendText = await page.locator('main').textContent();
check('revisión semanal: puntuación guardada y visible en tendencias', /Mejor: 🏋️ Salud física \(8\)/.test(trendText) && /a cuidar: ❤️ Relaciones \(4\)/.test(trendText), trendText.slice(trendText.indexOf('Tendencias'), trendText.indexOf('Tendencias') + 200));
await page.screenshot({ path: `${OUT}/p7-revisiones.png`, fullPage: true });

// ───────── Decisiones ─────────
await tab('Decisiones');
await page.click('button:has-text("Nueva decisión")');
await dialog().locator('input[name=title]').fill('¿Cambio a turno de día?');
await dialog().locator('textarea[name=objective]').fill('Dormir mejor y entrenar');
await dialog().locator('input[aria-label="Opción 1"]').fill('Seguir con noches');
await dialog().locator('textarea[aria-label="Ventajas de la opción 1"]').fill('Plus de nocturnidad');
await dialog().locator('input[aria-label="Opción 2"]').fill('Pasar a turno de día');
await dialog().locator('textarea[aria-label="Riesgos de la opción 2"]').fill('Menos sueldo');
await dialog().getByRole('button', { name: 'Guardar', exact: true }).click();
await closed();
await page.waitForSelector('h3:text-is("¿Cambio a turno de día?")');
check('decisiones: guarda opciones con ventajas y riesgos', /Plus de nocturnidad[\s\S]*Menos sueldo/.test(await page.locator('main').textContent()));

// ───────── Panel ─────────
await tab('Panel');
await page.waitForSelector('h2:has-text("Objetivos")');
const panel = await page.locator('main').textContent();
check('panel: objetivo principal con su progreso', /Entrenar 3 días por semana durante 12 semanas[\s\S]*25 %/.test(panel));
for (const s of ['🏋️Salud', '💰Finanzas', '💼Trabajo', '🧠Mente', '❤️Relaciones', '📚Aprendizaje', '⚠️ Alertas', '🚀 Hoy']) check(`panel: bloque ${s}`, panel.includes(s));
check('panel: mente con el ánimo de hoy', /Ánimo7\/10/.test(panel));
check('panel: avisa de entrevista incompleta', /Primera sesión/.test(panel));
await page.screenshot({ path: `${OUT}/p7-panel.png`, fullPage: true });

// ───────── Tareas creadas por el coach ─────────
await page.goto(`${BASE}/tasks`);
await page.waitForSelector('h1');
const tasksText = await page.locator('main').textContent();
check('tareas: incluye la acción del objetivo y la prioridad de mañana', /Lunes 18:00: fuerza 45 min/.test(tasksText) && /Preparar la revisión del motor/.test(tasksText));

// ───────── Asistente ─────────
await page.goto(`${BASE}/assistant?q=${encodeURIComponent('¿Cómo voy?')}`);
await page.waitForSelector('text=🎯 OBJETIVOS', { timeout: 15000 });
const reply = await page.locator('main').textContent();
check('asistente: «¿cómo voy?» responde con el dashboard personal', /Entrenar 3 días por semana/.test(reply) && /🚀 PRIORIDADES/.test(reply));
await page.goto(`${BASE}/coach?tab=decisiones`);
await page.click('a:has-text("Pedir análisis al asistente")');
await page.waitForSelector('text=DECISIÓN:', { timeout: 15000 });
check('asistente: analiza la decisión con el formato y señala huecos', /Antes de decidir, completa/.test(await page.locator('main').textContent()));

// ───────── Móvil ─────────
const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const mp = await mob.newPage();
await login(mp);
for (const t of ['panel', 'mapa', 'objetivos', 'revisiones', 'decisiones']) {
  await mp.goto(`${BASE}/coach?tab=${t}`);
  await mp.waitForSelector('h1');
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(`móvil: coach/${t} sin scroll horizontal`, overflow <= 0, `overflow ${overflow}px`);
  await mp.screenshot({ path: `${OUT}/p7-m-${t}.png`, fullPage: true });
}
await mob.close();

check('sin errores de consola ni excepciones', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
console.log(failures() === 0 ? 'Todo OK' : `${failures()} fallos`);
process.exit(failures() === 0 ? 0 : 1);
