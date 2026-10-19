// E2E Fase 8: estudio de contenido (YouTube y TikTok, calendario editorial, análisis, competencia y noticias del sector). Requiere app en marcha y seed fresco.
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
const tab = (name, pl = 'TikTok') => page.click(`[role=tablist][aria-label="Publicaciones de ${pl}"] [role=tab]:has-text("${name}")`);
const cards = () => page.locator('main ul.grid > li');
const pad = (n) => String(n).padStart(2, '0');
const local = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

const sections = ['/content/youtube', '/content/tiktok', '/content/calendar', '/content/analytics', '/content/competitors', '/content/news'];
check('menú lateral: las 6 secciones de contenido', (await Promise.all(sections.map((h) => page.locator(`aside nav a[href="${h}"]`).count()))).every((n) => n === 1));
await page.goto(`${BASE}/content`);
await page.waitForURL('**/content/youtube');
await page.waitForSelector('h1:text-is("YouTube")');
check('/content lleva a YouTube', true);
check('estudio: barra de secciones propia con la actual marcada', (await page.locator('nav[aria-label="Estudio de contenido"] a').count()) === 6 && (await page.locator('nav[aria-label="Estudio de contenido"] a[aria-current=page]').textContent()).includes('YouTube'));
await page.click('nav[aria-label="Estudio de contenido"] a:has-text("TikTok")');
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

// ── YouTube: tipos propios, publicada con resultados
await page.goto(`${BASE}/content/youtube`);
await page.waitForSelector('h1:text-is("YouTube")');
await page.click('button:has-text("Nueva idea")');
await dialog().waitFor();
const ytTypes = await page.locator('select[name=type] option').allTextContents();
check('YouTube: tipos propios (Vídeo, Short, Directo, Comunidad)', ytTypes.join(',') === 'Vídeo,Short,Directo,Comunidad', ytTypes.join(','));
check('YouTube: descripción hasta 5000', (await dialog().textContent()).includes('0/5000'));
await page.fill('input[name=title]', 'Así se revisa un motor por dentro');
await page.selectOption('select[name=type]', 'short');
await page.selectOption('select[name=status]', 'published');
check('publicada: aparecen los campos de resultados', (await page.locator('input[name=views]').count()) === 1);
await page.fill('input[name=views]', '12.500');
await page.fill('input[name=likes]', '900');
await page.fill('input[name=comments]', '40');
await page.fill('input[name=shares]', '60');
await page.click('[role=dialog] button[type=submit]');
await closed();
await tab('Publicadas', 'YouTube');
await page.waitForSelector('main li:has-text("Así se revisa un motor")');
check('YouTube: tarjeta con visualizaciones', (await cards().first().textContent()).includes('12.500 visualizaciones'));
check('YouTube y TikTok separados', (await page.locator('main li:has-text("Carrusel de herramientas")').count()) === 0);

// ── Análisis
await page.click('nav[aria-label="Estudio de contenido"] a:has-text("Análisis")');
await page.waitForSelector('h1:text-is("Análisis")');
const kpis = await page.locator('section[aria-label="Resumen de resultados"]').textContent();
check('análisis: publicadas, visualizaciones e interacción', /Publicadas2/.test(kpis) && kpis.includes('12,5 mil') && kpis.includes('8 %'), kpis);
check('análisis: gráficos con tabla alternativa', (await page.locator('main section:has(h3) button:has-text("Ver tabla")').count()) === 4);
const bars = await page.locator('ul[aria-label="Media de visualizaciones por día de la semana"] li').count();
check('análisis: por día solo los días con datos', bars === 1, String(bars));
check('análisis: ranking de lo mejor', (await page.locator('[aria-labelledby=top-title] li').count()) === 1);
await page.click('[role=tablist][aria-label=Plataforma] [role=tab]:has-text("TikTok")');
await page.waitForFunction(() => /Publicadas1/.test(document.querySelector('section[aria-label="Resumen de resultados"]')?.textContent ?? ''));
check('análisis: filtro por plataforma', true);
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/p8-analisis.png`, fullPage: true });

// ── Calendario editorial
await page.click('nav[aria-label="Estudio de contenido"] a:has-text("Calendario editorial")');
await page.waitForSelector('h1:text-is("Calendario editorial")');
const grid = page.locator('[role=grid]');
check('calendario: cuadrícula del mes con lo programado', (await grid.locator('button:has-text("Un día en el hangar")').count()) === 1);
check('calendario: lo publicado de ambas plataformas', (await grid.locator('button:has-text("Así se revisa un motor")').count()) === 1 && (await grid.locator('button:has-text("Carrusel de herramientas")').count()) === 1);
await page.click('[role=tablist][aria-label=Plataforma] [role=tab]:has-text("YouTube")');
await page.waitForFunction(() => !document.querySelector('[role=grid]')?.textContent?.includes('Un día en el hangar'));
check('calendario: filtro por plataforma', true);
await page.click('[role=tablist][aria-label=Plataforma] [role=tab]:has-text("Todas")');
const target = new Date(Date.now() + 2 * 86_400_000);
const targetKey = `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`;
const monthNow = `${new Date().getFullYear()}-${pad(new Date().getMonth() + 1)}`;
if (targetKey.slice(0, 7) !== monthNow) { await page.click('a[aria-label="Mes siguiente"]'); await page.waitForURL('**/content/calendar?m=*'); }
await page.locator(`[role=gridcell] button[aria-label^="Añadir el"]`).nth(0).waitFor({ state: 'attached' });
const addBtn = page.locator(`[role=gridcell][aria-label="${await page.evaluate((k) => new Date(`${k}T12:00:00Z`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }), targetKey)}"] button[aria-label^="Añadir"]`);
await addBtn.focus();
await addBtn.click();
await dialog().waitFor();
check('calendario: «+» abre una idea con plataforma a elegir y la fecha del día', (await page.locator('select[name=platform]').count()) === 1 && (await page.inputValue('input[name=scheduledAt]')).startsWith(targetKey));
await page.selectOption('select[name=platform]', 'tiktok');
check('al cambiar de plataforma cambian los tipos', (await page.locator('select[name=type] option').allTextContents()).includes('Carrusel'));
await page.fill('input[name=title]', 'Grabación en pista');
await page.selectOption('select[name=status]', 'scheduled');
await page.click('[role=dialog] button[type=submit]');
await closed();
await grid.locator('button:has-text("Grabación en pista")').waitFor();
check('calendario: la nueva aparece en su día', true);
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/p8-calendario.png`, fullPage: true });

// ── Competencia
await page.click('nav[aria-label="Estudio de contenido"] a:has-text("Competencia")');
await page.waitForSelector('h1:text-is("Competencia")');
check('competencia: vacía al principio', (await page.locator('text=Aún no sigues ninguna cuenta').count()) === 1);
const follow = async (name, platform, mine = false) => {
  await page.click('button:has-text("Seguir cuenta")');
  await dialog().waitFor();
  await page.selectOption('select[name=platform]', platform);
  await page.fill('input[name=name]', name);
  await page.fill('input[name=handle]', `@${name.toLowerCase().replace(/\s/g, '')}`);
  await page.fill('input[name=url]', 'https://www.youtube.com/@canal');
  if (mine) await page.check('input[name=mine]');
  await page.click('[role=dialog] button[type=submit]');
  await closed();
  await page.waitForSelector(`main li:has-text("${name}")`);
};
await follow('Hangar Pro', 'youtube');
await follow('Mi canal', 'youtube', true);
const logData = async (name, date, followers, avg = '') => {
  await page.click(`main li:has-text("${name}") button:has-text("Anotar datos")`);
  await dialog().waitFor();
  await page.fill('input[name=date]', date);
  await page.fill('input[name=followers]', followers);
  if (avg) await page.fill('input[name=avgViews]', avg);
  await page.click('[role=dialog] button[type=submit]');
  await closed();
};
const day = (n) => { const d = new Date(Date.now() - n * 86_400_000); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
await logData('Hangar Pro', day(30), '10.000');
await logData('Hangar Pro', day(0), '11.500', '4000');
await logData('Mi canal', day(0), '800');
await page.waitForSelector('main li:has-text("Hangar Pro"):has-text("11.500")');
const hp = await page.locator('main li:has-text("Hangar Pro")').textContent();
check('competencia: último dato y crecimiento en ~30 días', /\+1\.?500 \(\+15 %\)/.test(hp), hp);
check('competencia: «Tú» en tu cuenta', (await page.locator('main li:has-text("Mi canal") >> text=Tú').count()) === 1);
check('competencia: comparativa ordenada por seguidores', /Hangar Pro[\s\S]*Mi canal/.test(await page.locator('[aria-labelledby=rank-title]').textContent()));
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/p8-competencia.png`, fullPage: true });

// ── Noticias del sector
await page.click('nav[aria-label="Estudio de contenido"] a:has-text("Noticias del sector")');
await page.waitForSelector('h1:text-is("Noticias del sector")');
check('noticias: palabras clave por defecto', (await page.locator('section[aria-label="Palabras clave"] li').count()) === 5);
await page.fill('input[aria-label="Nueva palabra clave"]', 'Inflación');
await page.click('section[aria-label="Palabras clave"] button:has-text("Añadir")');
await page.waitForSelector('main li:has-text("La inflación en España se modera")');
check('noticias: aparece la noticia que coincide (sin tildes ni mayúsculas)', (await page.locator('main ul.grid > li').count()) === 1);
await page.click('main li:has-text("La inflación en España") button:has-text("Convertir en idea")');
await dialog().waitFor();
check('noticias: la idea llega con el título y la fuente en notas', (await page.inputValue('input[name=title]')).startsWith('La inflación en España') && (await page.inputValue('textarea[name=notes]')).includes('https://example.com/noticia/'));
await page.click('[role=dialog] button[type=submit]');
await closed();
await page.click('section[aria-label="Palabras clave"] button[aria-label="Quitar «Inflación»"]');
await page.waitForSelector('text=Ninguna noticia reciente sobre tus temas');
check('noticias: quitar la palabra clave la deja de mostrar', true);
await page.goto(`${BASE}/content/youtube`);
await tab('Borradores', 'YouTube');
await page.waitForSelector('main li:has-text("La inflación en España")');
check('noticias: la idea queda en los borradores de YouTube', true);

// ── Móvil
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: 'Europe/Madrid' });
const mp = await m.newPage();
await login(mp);
for (const h of sections) {
  await mp.goto(`${BASE}${h}`);
  await mp.waitForSelector('main h1');
  check(`móvil ${h}: sin desplazamiento horizontal`, await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
}
await mp.goto(`${BASE}/content/calendar`);
check('móvil: el calendario se ve como agenda', await mp.locator('ol[aria-label^="Agenda"]').isVisible() && !(await mp.locator('[role=grid]').isVisible()));
await mp.screenshot({ path: `${OUT}/p8-movil.png`, fullPage: true });

check('sin errores de consola ni excepciones', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
console.log(failures() === 0 ? 'Todo OK' : `${failures()} fallos`);
process.exit(failures() === 0 ? 0 : 1);
