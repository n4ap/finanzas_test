// Comprueba que las páginas principales no desbordan horizontalmente en móvil (390 px) y guarda capturas.
import { BASE, OUT, check, failures, launch, login } from './helpers.mjs';

const ROUTES = (process.env.ROUTES ?? 'dashboard,tasks,calendar,email,news,focus,finance,investments').split(',');
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await login(page);
for (const r of ROUTES) {
  await page.goto(`${BASE}/${r}`);
  await page.waitForSelector('main h1, h1');
  await page.waitForTimeout(500);
  const overflow = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  check(`móvil /${r}: sin scroll horizontal`, overflow.sw <= overflow.iw, `${overflow.sw}>${overflow.iw}`);
  await page.screenshot({ path: `${OUT}/m-${r}.png` });
}
// Email en móvil: lista → detalle → volver
await page.goto(`${BASE}/email`);
await page.click('section[aria-label="Lista de emails"] button:has-text("Propuesta de contrato")');
check('móvil email: el detalle sustituye a la lista', await page.locator('section[aria-label="Detalle del email"]').isVisible() && !(await page.locator('section[aria-label="Lista de emails"]').isVisible()));
await page.click('button[aria-label="Volver a la lista"]');
check('móvil email: volver a la lista', await page.locator('section[aria-label="Lista de emails"]').isVisible());
// Diálogo de nueva tarea usable en móvil (hoja inferior)
await page.goto(`${BASE}/tasks`);
await page.click('button:has-text("Nueva tarea")');
const box = await page.locator('[role=dialog]').boundingBox();
check('móvil tareas: el diálogo cabe en pantalla', box.width <= 390 && box.y >= 0);
await browser.close();
console.log(failures() ? `\n${failures()} comprobaciones fallidas` : '\nTodo OK');
process.exit(failures() ? 1 : 0);
