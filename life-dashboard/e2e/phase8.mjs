// E2E Fase 8: panel de contenido de TikTok (ideas, borradores, programadas, publicadas y registro de pendientes). Requiere app en marcha y seed fresco.
import { BASE, OUT, check, failures, launch, login } from './helpers.mjs';

const browser = await launch();
// Las fechas se muestran en hora de España: el navegador también, para que la hora escrita y la mostrada coincidan.
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'Europe/Madrid' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
page.on('dialog', (d) => d.accept());
await login(page);
const dialog = () => page.locator('[role=dialog]');
const closed = () => page.waitForSelector('[role=dialog]', { state: 'detached' });
const tab = (name) => page.click(`[role=tablist][aria-label="Sección de contenido"] [role=tab]:has-text("${name}")`);
const cards = () => page.locator('main ul > li');
const pad = (n) => String(n).padStart(2, '0');
const local = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

check('menú: enlace «TikTok»', (await page.locator('nav a[href="/content"]').count()) >= 1);
await page.goto(`${BASE}/content`);
await page.waitForSelector('h1:text-is("TikTok")');
check('panel: un único h1 y siempre oscuro', (await page.locator('h1').count()) === 1 && (await page.locator('main .dark h1').count()) === 1);
check('panel: vacío al principio', (await page.locator('text=No hay publicaciones programadas').count()) === 1);

// ── Nueva idea
await page.click('button:has-text("Nueva idea")');
await dialog().waitFor();
await page.fill('input[name=title]', 'Un día en el hangar');
await page.fill('textarea[name=caption]', 'Así revisamos un motor antes de volar ✈️');
check('formulario: contador del subtítulo', /\b4\d\/2200/.test(await dialog().textContent()));
await page.fill('input[name=hashtags]', 'aviacion, mecanico');
await page.selectOption('select[name=type]', 'video');
await page.click('[role=dialog] button[type=submit]');
await closed();
await tab('Borradores');
await page.waitForSelector('main li:has-text("Un día en el hangar")');
check('borradores: la idea aparece con estado y hashtags', /Idea[\s\S]*Vídeo[\s\S]*#aviacion #mecanico/.test(await cards().first().textContent()));

// ── Pasar a borrador → Programar (exige fecha)
await page.click('main li:has-text("Un día en el hangar") button:has-text("Pasar a borrador")');
await page.waitForSelector('main li:has-text("Un día en el hangar") button:has-text("Programar")');
check('tarjeta: «Pasar a borrador» cambia el estado', (await cards().first().textContent()).includes('Borrador'));
await page.click('main li:has-text("Un día en el hangar") button:has-text("Programar")');
await dialog().waitFor();
check('programar: abre el formulario en «Programada» con fecha obligatoria', (await page.inputValue('select[name=status]')) === 'scheduled' && (await page.locator('input[name=scheduledAt][required]').count()) === 1);
const tomorrow = new Date(Date.now() + 86_400_000); tomorrow.setHours(18, 0, 0, 0);
await page.fill('input[name=scheduledAt]', local(tomorrow));
await page.click('[role=dialog] button[type=submit]');
await closed();
await tab('Programadas');
await page.waitForSelector('main li:has-text("Un día en el hangar")');
check('programadas: aparece con su fecha', /Programada ·.*18:00/.test(await cards().first().textContent()));
check('resumen: 1 programada en los próximos 7 días', (await page.locator('section[aria-label=Resumen]').textContent()).includes('1 en los próximos 7 días'));

// ── Una programada atrasada y una idea sin fecha → registro de pendientes
await page.click('button:has-text("Nueva idea")');
await dialog().waitFor();
await page.fill('input[name=title]', 'Carrusel de herramientas');
await page.selectOption('select[name=type]', 'carousel');
await page.selectOption('select[name=status]', 'scheduled');
const yesterday = new Date(Date.now() - 86_400_000); yesterday.setHours(9, 0, 0, 0);
await page.fill('input[name=scheduledAt]', local(yesterday));
await page.click('[role=dialog] button[type=submit]');
await closed();
await page.click('button:has-text("Nueva idea")');
await dialog().waitFor();
await page.fill('input[name=title]', 'Idea sin fecha');
await page.click('[role=dialog] button[type=submit]');
await closed();
await page.waitForSelector('text=1 atrasada');
check('resumen: avisa de 1 atrasada', true);
await tab('Pendientes');
const log = page.locator('ol[aria-label="Registro de publicaciones pendientes"] > li');
await log.first().waitFor();
const order = await log.allTextContents();
check('pendientes: atrasada primero, luego por fecha, sin fecha al final', order.length === 3 && /Carrusel de herramientas[\s\S]*Atrasada/.test(order[0]) && order[1].includes('Un día en el hangar') && /Sin fecha[\s\S]*Idea sin fecha/.test(order[2]), order.join(' | '));
await page.waitForTimeout(300); // que terminen las transiciones de color antes de la captura
await page.screenshot({ path: `${OUT}/p8-pendientes.png`, fullPage: true });

// ── Marcar publicada
await tab('Programadas');
await page.click('main li:has-text("Carrusel de herramientas") button:has-text("Marcar publicada")');
await page.waitForSelector('text=Sin atrasos');
await tab('Publicadas');
await page.waitForSelector('main li:has-text("Carrusel de herramientas")');
check('publicadas: aparece con su fecha de publicación', /Publicada[\s\S]*Carrusel[\s\S]*Publicada ·/.test(await cards().first().textContent()));
await page.waitForTimeout(300); // que terminen las transiciones de color antes de la captura
await page.screenshot({ path: `${OUT}/p8-publicadas.png`, fullPage: true });

// ── Editar y eliminar desde el registro
await tab('Pendientes');
await page.click('ol[aria-label="Registro de publicaciones pendientes"] button:has-text("Idea sin fecha")');
await dialog().waitFor();
check('registro: abre la publicación para editarla', (await page.inputValue('input[name=title]')) === 'Idea sin fecha');
await page.click('[role=dialog] button:has-text("Eliminar")');
await closed();
await page.waitForFunction(() => !document.querySelector('main')?.textContent?.includes('Idea sin fecha'));
check('eliminar: desaparece del registro', (await log.count()) === 1);

// ── Validación en servidor
await page.click('button:has-text("Nueva idea")');
await dialog().waitFor();
await page.fill('input[name=title]', '   ');
await page.click('[role=dialog] button[type=submit]');
await page.waitForSelector('[role=dialog] [role=alert]');
check('validación: título vacío muestra error', (await page.locator('[role=dialog] [role=alert]').textContent()).includes('obligatorio'));
await page.keyboard.press('Escape');
await closed();

// ── Móvil
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const mp = await m.newPage();
await login(mp);
await mp.goto(`${BASE}/content`);
await mp.waitForSelector('h1:text-is("TikTok")');
check('móvil: sin desplazamiento horizontal', await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
check('móvil: las pestañas no se salen del panel', await mp.evaluate(() => { const t = document.querySelector('[aria-label="Sección de contenido"]').parentElement.getBoundingClientRect(), d = document.querySelector('main .dark').getBoundingClientRect(); return t.right <= d.right; }));
await mp.screenshot({ path: `${OUT}/p8-movil.png`, fullPage: true });

check('sin errores de consola ni excepciones', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
console.log(failures() === 0 ? 'Todo OK' : `${failures()} fallos`);
process.exit(failures() === 0 ? 0 : 1);
