// E2E Fase 3: finanzas e inversiones. Requiere app en marcha y seed fresco.
import { writeFileSync } from 'node:fs';
import { BASE, OUT, check, failures, launch, login, openSearch } from './helpers.mjs';

const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
await login(page);
const tab = (name) => page.click(`[role=tab]:has-text("${name}")`);
const acct = (name) => `li:has(p.font-medium:text-is("${name}"))`;
const accountNames = (pg) => pg.locator('main ul > li p.font-medium').allTextContents();

// ───────── Dashboard integrado ─────────
const finW = await page.locator('section[aria-label=Finanzas]').textContent();
check('dashboard: el widget de finanzas avisa del presupuesto superado (ocio)', /presupuestos? superados?: .*Ocio/.test(finW), finW.slice(0, 200));
check('dashboard: widget de finanzas con gráfico', (await page.locator('section[aria-label=Finanzas] svg.recharts-surface').count()) >= 1);

// ───────── Resumen ─────────
await page.goto(`${BASE}/finance`);
await page.waitForSelector('text=Gastos por categoría');
check('finanzas: un único h1', (await page.locator('h1').count()) === 1);
for (const t of ['Gastos por categoría', 'Ingresos vs gastos', 'Evolución mensual de gastos', 'Ahorro mensual']) check(`resumen: gráfico «${t}»`, (await page.getByRole('heading', { name: t }).count()) === 1);
for (const k of ['Ingresos', 'Gastos', 'Ahorro', 'Saldo en cuentas', 'Patrimonio']) check(`resumen: KPI ${k}`, (await page.locator(`p:text-is("${k}")`).count()) >= 1);
check('resumen: leyenda en gráficos de 2 series', (await page.locator('ul[aria-label=Leyenda]').count()) >= 2);
// Tabla alternativa
const card = page.locator('section', { has: page.getByRole('heading', { name: 'Ingresos vs gastos' }) });
await card.getByRole('button', { name: 'Ver tabla' }).click();
check('resumen: vista de tabla alternativa (6 meses)', (await card.locator('tbody tr').count()) === 6);
await card.getByRole('button', { name: 'Ver gráfico' }).click();
// Colores desde variables CSS (claro y oscuro)
const fill = () => page.evaluate(() => { const p = document.querySelector('.recharts-bar-rectangle path'); return p ? getComputedStyle(p).fill : null; });
check('gráficos: barras usan la serie 1 (azul) en claro', (await fill()) === 'rgb(42, 120, 214)', await fill());
await page.screenshot({ path: `${OUT}/finance-summary-light.png`, fullPage: true });
await page.click('button[aria-label="Cambiar a modo oscuro"]');
await page.waitForTimeout(300);
check('gráficos: barras usan la serie 1 de oscuro', (await fill()) === 'rgb(57, 135, 229)', await fill());
await page.screenshot({ path: `${OUT}/finance-summary-dark.png`, fullPage: true });
await page.click('button[aria-label="Cambiar a modo claro"]');
// Navegación de mes
const monthLbl = async () => (await page.locator('[aria-live=polite]').first().textContent()).trim();
const m0 = await monthLbl();
await page.click('button[aria-label="Mes anterior"]');
await page.waitForFunction((m) => document.querySelector('[aria-live=polite]')?.textContent?.trim() !== m, m0);
check('resumen: navegar al mes anterior cambia datos y etiqueta', (await monthLbl()) !== m0);
await page.click('button[aria-label="Mes siguiente"]');
await page.waitForFunction((m) => document.querySelector('[aria-live=polite]')?.textContent?.trim() === m, m0);

// ───────── Movimientos: CRUD + auditoría ─────────
await tab('Movimientos');
await page.waitForSelector('ul[aria-label=Movimientos]');
await page.click('button:has-text("Nuevo movimiento")');
await page.fill('input[name=description]', 'Mercadona E2E');
check('movimientos: categoría sugerida por el concepto', (await page.locator('[role=dialog] select').nth(1).inputValue()) === 'alimentacion');
await page.fill('input[name=amount]', '0');
await page.click('button[type=submit]:has-text("Guardar")');
await page.waitForSelector('[role=dialog] [role=alert]');
check('movimientos: importe 0 rechazado con mensaje', (await page.textContent('[role=dialog] [role=alert]')).includes('no puede ser 0'));
await page.fill('input[name=amount]', '12,34');
await page.click('button[type=submit]:has-text("Guardar")');
await page.waitForSelector('text=Mercadona E2E');
check('movimientos: crear gasto con coma decimal', (await page.locator('li:has-text("Mercadona E2E")').first().textContent()).includes('12,34'));
await page.click('li:has-text("Mercadona E2E") button >> nth=0');
await page.fill('input[name=amount]', '20');
await page.click('button[type=submit]:has-text("Guardar")');
await page.waitForSelector('li:has-text("Mercadona E2E"):has-text("20,00")');
check('movimientos: editar', true);
// Fórmula maliciosa → exportación segura
await page.click('button:has-text("Nuevo movimiento")');
await page.fill('input[name=description]', '=HYPERLINK("http://evil.test","x")');
await page.fill('input[name=amount]', '1');
await page.click('button[type=submit]:has-text("Guardar")');
await page.waitForSelector('li:has-text("HYPERLINK")');
const exp = await ctx.request.get(`${BASE}/api/finance/export`);
const csv = await exp.text();
check('export: CSV con BOM y cabecera', csv.startsWith('﻿fecha;cuenta;concepto;categoria;importe'));
check('export: neutraliza inyección de fórmulas', csv.includes(`"'=HYPERLINK`) && !/;=HYPERLINK/.test(csv));
check('export: importes con coma decimal', /;-?\d+,\d{2}\r?\n?/.test(csv));
check('export: requiere sesión', (await (await browser.newContext()).request.get(`${BASE}/api/finance/export`)).status() === 401);
// Filtros
await page.fill('input[aria-label="Buscar movimientos"]', 'mercadona e2e');
await page.waitForFunction(() => location.search.includes('q=mercadona'));
await page.waitForSelector('text=1 movimiento');
check('movimientos: búsqueda en URL y filtra', (await page.locator('ul[aria-label=Movimientos] li').count()) === 1);
await page.fill('input[aria-label="Buscar movimientos"]', '');
await page.waitForFunction(() => !location.search.includes('q='));
await page.selectOption('select[aria-label="Filtrar por categoría"]', 'suscripciones');
await page.waitForFunction(() => location.search.includes('category=suscripciones'));
await page.waitForTimeout(600);
const subs = await page.locator('ul[aria-label=Movimientos] li').allTextContents();
check('movimientos: filtro por categoría', subs.length > 0 && subs.every((t) => t.includes('Suscripciones')));
await page.selectOption('select[aria-label="Filtrar por categoría"]', '');
await page.waitForFunction(() => !location.search.includes('category='));
// Borrar el movimiento de prueba y comprobar auditoría
await page.click('li:has-text("Mercadona E2E") button >> nth=0');
page.once('dialog', (d) => d.accept());
await page.click('button:has-text("Eliminar")');
await page.waitForFunction(() => !document.body.textContent.includes('Mercadona E2E'));
await tab('Historial');
await page.waitForSelector('ul[aria-label="Historial de cambios"]');
const hist = await page.locator('ul[aria-label="Historial de cambios"]').textContent();
check('historial: creado, modificado y eliminado con importe', /Creado/.test(hist) && /Modificado/.test(hist) && /Eliminado/.test(hist) && hist.includes('Mercadona E2E'));

// ───────── Presupuestos ─────────
await tab('Presupuestos');
await page.waitForSelector('text=Superado');
check('presupuestos: ocio superado (texto, no solo color)', (await page.locator('li:has-text("Ocio")').first().textContent()).includes('Superado'));
await page.click('button[aria-label="Editar presupuesto de Ocio"]');
await page.fill('input[name=monthly]', '1000');
await page.click('button[type=submit]:has-text("Guardar")');
await page.waitForFunction(() => !document.querySelector('li')?.textContent?.includes('Superado') || true);
await page.waitForTimeout(800);
check('presupuestos: editar límite actualiza el estado', !(await page.locator('li:has-text("Ocio")').first().textContent()).includes('Superado'));
await page.click('button[aria-label="Editar presupuesto de Compras"]');
await page.fill('input[name=monthly]', '0');
await page.click('button[type=submit]:has-text("Guardar")');
await page.waitForTimeout(800);
check('presupuestos: 0 elimina el presupuesto', (await page.locator('li:has-text("Compras")').count()) === 0);
await page.screenshot({ path: `${OUT}/finance-budgets.png` });

// ───────── Importar CSV ─────────
const now = new Date();
const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
const pm = String(prev.getMonth() + 1).padStart(2, '0'), py = prev.getFullYear();
const file = '/tmp/claude-0/shots/extracto.csv';
writeFileSync(file, [
  'Fecha;Concepto;Importe;Saldo',
  `10/${pm}/${py};Netflix;-15,99;1000,00`,                 // duplicado de un movimiento sembrado
  `11/${pm}/${py};"Cena, con amigos ""E2E""";-45,30;950,00`, // comillas y coma interna
  `12/${pm}/${py};MERCADONA COMPRA E2E;-1.234,56;800,00`,  // miles con punto
  `13/${pm}/${py};Nómina extra E2E;1.500,00;2300,00`,     // ingreso
  `31/02/${py};Fecha imposible;-5,00;0`,                   // error
].join('\n'));
await tab('Importar');
await page.waitForSelector('text=Importar en la cuenta');
await page.selectOption('main select >> nth=0', { label: 'Cuenta corriente' });
await page.setInputFiles('#csv-file', file);
await page.waitForSelector('section[aria-label="Vista previa de la importación"]');
const prevText = await page.locator('section[aria-label="Vista previa de la importación"]').textContent();
check('importar: detecta 3 nuevas, 1 existente y 1 error', /3 nuevas/.test(prevText) && /1 ya existentes/.test(prevText) && /1 con errores/.test(prevText), prevText.slice(0, 160));
check('importar: el error indica la línea', /Línea 6: Fecha no válida/.test(prevText));
check('importar: «1.234,56» se interpreta como 1.234,56', prevText.includes('1.234,56'));
check('importar: el duplicado llega desmarcado', !(await page.locator('input[aria-label="Importar fila 2"]').isChecked()));
check('importar: categoría sugerida (Mercadona → alimentacion)', (await page.locator('select[aria-label="Categoría de la fila 4"]').inputValue()) === 'alimentacion');
check('importar: ingreso → categoría ingresos', (await page.locator('select[aria-label="Categoría de la fila 5"]').inputValue()) === 'ingresos');
await page.screenshot({ path: `${OUT}/finance-import.png` });
await page.click('button:has-text("Importar 3 movimientos")');
await page.waitForSelector('text=Importados 3 movimientos');
check('importar: resultado', true);
// Reimportar el mismo archivo → todo existente
await page.setInputFiles('#csv-file', file);
await page.waitForSelector('section[aria-label="Vista previa de la importación"]');
const again = await page.locator('section[aria-label="Vista previa de la importación"]').textContent();
check('importar: reimportar no duplica (4 ya existentes, 0 nuevas)', /0 nuevas/.test(again) && /4 ya existentes/.test(again), again.slice(0, 120));
check('importar: botón desactivado sin selección', await page.locator('button:has-text("Importar 0 movimientos")').isDisabled());
// Columnas no reconocidas → mapeo manual
const odd = '/tmp/claude-0/shots/raro.csv';
writeFileSync(odd, `Col A,Col B,Col C\n${py}-${pm}-20,Compra rara E2E,-9.99\n`);
await page.setInputFiles('#csv-file', odd);
await page.waitForSelector('text=No he reconocido las columnas');
await page.locator('select').nth(1).selectOption('0'); // fecha
await page.locator('label:has-text("Fecha") select').selectOption('0');
await page.locator('label:has-text("Concepto") select').selectOption('1');
await page.locator('label:has-text("Importe (con signo)") select').selectOption('2');
await page.click('button:has-text("Aplicar columnas")');
await page.waitForSelector('text=1 nuevas');
check('importar: mapeo manual de columnas', true);
// Archivo demasiado grande
writeFileSync('/tmp/claude-0/shots/grande.csv', 'a;b;c\n' + 'x;y;z\n'.repeat(250_000));
await page.setInputFiles('#csv-file', '/tmp/claude-0/shots/grande.csv');
await page.waitForSelector('text=demasiado grande');
check('importar: rechaza archivos de más de 1 MB', true);
await tab('Movimientos');
await page.waitForSelector('ul[aria-label=Movimientos]');
await page.click('[aria-label="Mes anterior"]');
await page.waitForSelector('text=Nómina extra E2E');
check('importar: lo importado aparece en Movimientos con etiqueta CSV', (await page.locator('li:has-text("Nómina extra E2E")').textContent()).includes('CSV'));

// ───────── Cuentas y cuenta compartida (dos usuarios) ─────────
await tab('Cuentas');
await page.waitForSelector('text=Cuentas manuales');
const alexNames = (await accountNames(page)).sort();
check('cuentas: Alex ve sus 3 cuentas (una compartida con Sam Demo)', JSON.stringify(alexNames) === JSON.stringify(['Cuenta ahorro', 'Cuenta conjunta', 'Cuenta corriente']) && (await page.locator('main').textContent()).includes('Compartida con Sam Demo'), alexNames.join('|'));
check('cuentas: la cuenta privada de la pareja NO aparece', !alexNames.includes('Cuenta Sam'));
const other = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const op = await other.newPage();
await login(op, 'pareja@lifedashboard.dev');
await op.goto(`${BASE}/finance?tab=cuentas`);
await op.waitForSelector('text=Cuentas manuales');
const samNames = (await accountNames(op)).sort();
check('pareja: ve su cuenta y la conjunta, pero no las privadas de Alex', JSON.stringify(samNames) === JSON.stringify(['Cuenta conjunta', 'Cuenta Sam'].sort()), samNames.join('|'));
// Alex comparte «Cuenta corriente» con la pareja
await page.click(`${acct('Cuenta corriente')} button:text-is("Compartir")`);
page.once('dialog', (d) => d.accept());
await page.fill('input[type=email]', 'nadie@test.dev');
await page.click('button[type=submit]:has-text("Compartir")');
await page.waitForSelector('text=No hay ningún usuario registrado');
check('compartir: email inexistente da error claro', true);
page.once('dialog', (d) => d.accept());
await page.fill('input[type=email]', 'pareja@lifedashboard.dev');
await page.click('button[type=submit]:has-text("Compartir")');
await page.waitForSelector('text=Cuenta compartida con Sam Demo');
check('compartir: confirmación con aviso', true);
await page.keyboard.press('Escape');
await op.reload();
await op.waitForSelector('text=Cuentas manuales');
check('pareja: ahora ve «Cuenta corriente» compartida (3 cuentas)', (await accountNames(op)).includes('Cuenta corriente') && (await accountNames(op)).length === 3);
// La pareja edita un movimiento de la cuenta compartida
await op.goto(`${BASE}/finance?tab=movimientos&month=${py}-${pm}`);
await op.waitForSelector('ul[aria-label=Movimientos]');
await op.click('li:has-text("Netflix") button >> nth=0');
await op.fill('input[name=description]', 'Netflix editado por Sam');
await op.click('button[type=submit]:has-text("Guardar")');
await op.waitForSelector('text=Netflix editado por Sam');
await page.goto(`${BASE}/finance?tab=historial`);
await page.waitForSelector('ul[aria-label="Historial de cambios"]');
check('historial: Alex ve que Sam Demo editó el movimiento compartido', /Sam Demo/.test(await page.locator('ul[aria-label="Historial de cambios"]').textContent()));
// Dejar de compartir
await page.goto(`${BASE}/finance?tab=cuentas`);
page.once('dialog', (d) => d.accept());
await page.click(`${acct('Cuenta corriente')} button:has-text("Dejar de compartir")`);
await page.waitForSelector(`${acct('Cuenta corriente')}:has-text("Privada")`);
await op.goto(`${BASE}/finance?tab=cuentas`);
await op.waitForSelector('text=Cuentas manuales');
check('dejar de compartir: la pareja pierde el acceso', !(await accountNames(op)).includes('Cuenta corriente'), (await accountNames(op)).join('|'));
// Crear y borrar cuenta
await page.click('button:has-text("Nueva cuenta")');
await page.fill('input[name=name]', 'Cuenta E2E');
await page.fill('input[name=openingBalance]', '250,50');
await page.click('button[type=submit]:has-text("Guardar")');
await page.waitForSelector(`${acct('Cuenta E2E')}:has-text("250,50")`);
check('cuentas: crear con saldo inicial', true);
await page.click('button[aria-label="Editar Cuenta E2E"]');
page.once('dialog', (d) => d.accept());
await page.click('button:has-text("Eliminar cuenta")');
await page.waitForFunction(() => !document.body.textContent.includes('Cuenta E2E'));
check('cuentas: eliminar', true);

// ───────── Inversiones ─────────
await page.goto(`${BASE}/investments`);
await page.waitForSelector('section[aria-label=Posiciones]');
check('inversiones: un único h1', (await page.locator('h1').count()) === 1);
check('inversiones: 7 posiciones', (await page.locator('section[aria-label=Posiciones] tbody tr').count()) === 7);
for (const t of ['Evolución de la cartera', 'Distribución por tipo de activo', 'Dividendos cobrados']) check(`inversiones: «${t}»`, (await page.getByRole('heading', { name: t }).count()) === 1);
check('inversiones: evolución con línea (≥2 puntos)', (await page.locator('section', { has: page.getByRole('heading', { name: 'Evolución de la cartera' }) }).locator('path.recharts-line-curve').count()) >= 2);
check('inversiones: distribución con 4 tipos y porcentajes', (await page.locator('[aria-label="Distribución de la cartera"] li').count()) === 4);
const evoCard = page.locator('section', { has: page.getByRole('heading', { name: 'Evolución de la cartera' }) });
await page.screenshot({ path: `${OUT}/investments.png`, fullPage: true });
await evoCard.getByRole('button', { name: 'Ver tabla' }).click();
check('inversiones: tabla alternativa de la evolución', (await evoCard.locator('tbody tr').count()) > 40);
check('inversiones: las fechas de la evolución incluyen el año', /\d{1,2} \w{3,4} \d{2}/.test(await evoCard.locator('tbody tr').first().textContent()));
// Editar precio
const valueBefore = await page.locator('section[aria-label=Posiciones] tr:has-text("VWCE") td').nth(4).textContent();
await page.click('button[aria-label="Editar VWCE"]');
await page.fill('input[name=currentPrice]', '130');
await page.click('button[type=submit]:has-text("Guardar")');
await page.waitForFunction((v) => document.querySelector('section[aria-label=Posiciones] tr:nth-child(1)')?.textContent !== v || true, valueBefore);
await page.waitForTimeout(900);
const valueAfter = await page.locator('section[aria-label=Posiciones] tr:has-text("VWCE") td').nth(4).textContent();
check('inversiones: actualizar el precio recalcula el valor (62 × 130 = 8.060 €)', valueBefore !== valueAfter && valueAfter.includes('8.060'), `${valueBefore} → ${valueAfter}`);
// Nueva posición + validación
await page.click('button:has-text("Nueva posición")');
await page.fill('input[name=symbol]', 'a b!');
await page.fill('input[name=name]', 'Prueba');
await page.fill('input[name=quantity]', '2');
await page.fill('input[name=avgCost]', '10');
await page.fill('input[name=currentPrice]', '12');
await page.click('button[type=submit]:has-text("Guardar")');
await page.waitForSelector('[role=dialog] [role=alert]');
check('inversiones: símbolo inválido rechazado', (await page.textContent('[role=dialog] [role=alert]')).includes('Símbolo'));
await page.fill('input[name=symbol]', 'tst');
await page.click('button[type=submit]:has-text("Guardar")');
await page.waitForSelector('section[aria-label=Posiciones] tr:has-text("TST")');
check('inversiones: crear posición (símbolo en mayúsculas)', true);
// Dividendo
await page.click('button:has-text("Registrar dividendo")');
await page.selectOption('select[name=investmentId]', { label: 'TST · Prueba' });
await page.fill('input[name=amount]', '3,5');
await page.click('button[type=submit]:has-text("Guardar")');
await page.waitForSelector('section[aria-label="Últimos dividendos"] >> text=TST');
check('inversiones: registrar dividendo', true);
await page.click('button[aria-label="Editar TST"]');
page.once('dialog', (d) => d.accept());
await page.click('button:has-text("Eliminar")');
await page.waitForFunction(() => !document.querySelector('section[aria-label=Posiciones]')?.textContent?.includes('TST'));
check('inversiones: eliminar posición', true);
// Historial de auditoría de inversión
await page.goto(`${BASE}/finance?tab=historial`);
check('historial: incluye cambios de inversiones', /Posición/.test(await page.locator('ul[aria-label="Historial de cambios"]').textContent()));

// ───────── Búsqueda global ─────────
await openSearch(page);
await page.keyboard.type('VWCE');
await page.waitForSelector('[role=dialog] >> text=Inversiones');
check('búsqueda global: encuentra posiciones', true);
await page.keyboard.press('Escape');

// ───────── Aislamiento: Sam no ve el patrimonio de Alex ─────────
await op.goto(`${BASE}/investments`);
await op.waitForSelector('text=Sin posiciones');
check('aislamiento: la pareja no ve las inversiones de Alex', !(await op.textContent('body')).includes('VWCE'));
await op.goto(`${BASE}/finance`);
await op.waitForSelector('text=Gastos');
check('aislamiento: el resumen de Sam no incluye el saldo de Alex', !(await op.textContent('body')).includes('Cuenta ahorro'));

check('sin errores JS en consola', errors.length === 0 && true, errors.slice(0, 3).join(' | '));
await browser.close();
console.log(failures() ? `\n${failures()} comprobaciones fallidas` : '\nTodo OK');
process.exit(failures() ? 1 : 0);
