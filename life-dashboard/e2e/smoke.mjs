// Prueba de humo end-to-end con Playwright (usa el Chromium preinstalado). Requiere la app en BASE_URL y el seed cargado.
import { chromium } from 'playwright-core';
import { openSearch } from './helpers.mjs';

const BASE = process.env.BASE_URL ?? 'http://localhost:3100';
const OUT = process.env.SHOTS ?? '/tmp/claude-0/shots';
const exe = process.env.CHROMIUM ?? '/opt/pw-browsers/chromium';
let failed = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`); if (!ok) failed++; };

const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && !m.text().includes('Failed to load resource') && errors.push(m.text()));

// Login con credenciales erróneas
await page.goto(`${BASE}/login`);
await page.fill('input[name=email]', 'demo@lifedashboard.dev');
await page.fill('input[name=password]', 'incorrecta');
await page.click('button[type=submit]');
await page.waitForSelector('form [role=alert]');
check('login erróneo muestra error', (await page.textContent('form [role=alert]')).includes('incorrectos'));

// Login correcto
await page.fill('input[name=password]', 'demo-password-123');
await page.click('button[type=submit]');
await page.waitForURL('**/dashboard', { waitUntil: 'commit' });
await page.waitForSelector('text=Mi día');
check('login correcto → /dashboard', true);
check('saludo visible', /Buen(os|as)/.test(await page.textContent('[data-greeting]')));
for (const w of ['Mi día', 'Prioridades', '¿Qué debería hacer ahora?', 'Calendario', 'Email', 'Tareas', 'Lo importante de hoy', 'Finanzas', 'Inversiones', 'Salud', 'Proyectos', 'Viajes', 'Notificaciones', 'Asistente IA'])
  check(`widget «${w}»`, (await page.locator(`section[aria-label="${w}"]`).count()) === 1);
check('detecta conflicto de calendario en Prioridades', (await page.locator('section[aria-label=Prioridades]').textContent()).includes('Conflicto'));
check('detecta tarea atrasada', (await page.locator('section[aria-label=Prioridades]').textContent()).includes('Atrasada'));
await page.screenshot({ path: `${OUT}/desktop-light.png`, fullPage: true });

// Búsqueda global Ctrl+K
await openSearch(page);
await page.waitForSelector('[role=dialog][aria-label="Búsqueda global"]');
await page.keyboard.type('contrato');
await page.waitForSelector('text=Emails');
check('Ctrl+K busca en emails agrupando resultados', (await page.textContent('[role=dialog]')).includes('Propuesta de contrato'));
await page.screenshot({ path: `${OUT}/search.png` });
await page.keyboard.press('Escape');

// Notificaciones
await page.click('button[aria-label^=Notificaciones]');
check('centro de notificaciones abre', await page.locator('[role=dialog][aria-label="Centro de notificaciones"]').isVisible());
await page.click('text=Marcar todas como leídas');
await page.waitForTimeout(800);
await page.keyboard.press('Escape');
await page.mouse.click(700, 20);

// Personalizar widgets: ocultar y persistir
await page.click('button:has-text("Personalizar")');
await page.click('[aria-label="Controles de Viajes"] [aria-label="Ocultar widget"]');
await page.waitForTimeout(800);
check('widget oculto', (await page.locator('section[aria-label=Viajes]').count()) === 0);
await page.reload();
await page.waitForSelector('text=Mi día');
check('layout persiste tras recargar', (await page.locator('section[aria-label=Viajes]').count()) === 0);
await page.click('button:has-text("Personalizar")');
await page.click('button:has-text("Viajes")');
await page.waitForTimeout(800);
check('widget restaurado', (await page.locator('section[aria-label=Viajes]').count()) === 1);

// Tema oscuro
await page.click('button[aria-label="Cambiar a modo oscuro"]');
check('modo oscuro', await page.evaluate(() => document.documentElement.classList.contains('dark')));
await page.screenshot({ path: `${OUT}/desktop-dark.png`, fullPage: true });

// Focus
await page.goto(`${BASE}/focus`);
await page.click('text=¿Qué hago ahora?');
check('Focus muestra recomendación', await page.locator('[role=status]').isVisible());
await page.screenshot({ path: `${OUT}/focus.png` });

// Móvil
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const mp = await m.newPage();
await mp.goto(`${BASE}/login`);
await mp.fill('input[name=email]', 'demo@lifedashboard.dev');
await mp.fill('input[name=password]', 'demo-password-123');
await mp.click('button[type=submit]');
await mp.waitForURL('**/dashboard', { waitUntil: 'commit' });
await mp.waitForSelector('text=Mi día');
check('móvil: bottom nav visible', await mp.locator('nav[aria-label="Navegación móvil"]').isVisible());
check('móvil: sidebar oculta', !(await mp.locator('aside').isVisible()));
check('móvil: sin scroll horizontal', await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
await mp.screenshot({ path: `${OUT}/mobile.png`, fullPage: false });

// Logout y protección
await page.goto(`${BASE}/dashboard`);
await page.click('button[aria-label="Menú de usuario"]');
await page.click('text=Cerrar sesión');
await page.waitForURL('**/login', { waitUntil: 'commit' });
await page.goto(`${BASE}/dashboard`);
check('tras logout /dashboard redirige a login', page.url().endsWith('/login'));

check('sin errores JS en consola', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
console.log(failed ? `\n${failed} comprobaciones fallidas` : '\nTodo OK');
process.exit(failed ? 1 : 0);
