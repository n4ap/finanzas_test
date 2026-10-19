// E2E Fase 6: ajustes, conexiones (iCal/RSS), IA con Claude simulado, seguridad, privacidad y PWA/CSP.
// Requiere las dos instancias que levanta e2e/run.sh (permisiva en BASE_URL y estricta en STRICT_URL) y el puerto MOCK_PORT libre.
import http from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { BASE, OUT, check, failures, launch, login } from './helpers.mjs';

const STRICT = process.env.STRICT_URL ?? 'http://localhost:3101';
const MOCK_PORT = Number(process.env.MOCK_PORT ?? 3199);
const soon = (days, h = 10) => { const d = new Date(Date.now() + days * 86_400_000); return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}T${String(h).padStart(2, '0')}0000Z`; };
const ICS = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:e2e-1\r\nSUMMARY:Reunión de equipo (iCal)\r\nDTSTART:${soon(2)}\r\nDTEND:${soon(2, 11)}\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:e2e-2\r\nSUMMARY:Revisión trimestral (iCal)\r\nDTSTART:${soon(3)}\r\nDTEND:${soon(3, 11)}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
const RSS = `<?xml version="1.0"?><rss version="2.0"><channel><title>Blog de pruebas</title><item><title>Primera noticia del feed</title><link>https://ejemplo.com/1</link><guid>n1</guid><description>&lt;p&gt;Resumen &lt;b&gt;limpio&lt;/b&gt;&lt;/p&gt;</description><pubDate>${new Date().toUTCString()}</pubDate></item><item><title>Segunda noticia del feed</title><link>javascript:alert(1)</link><guid>n2</guid></item><item><title>Tercera noticia del feed</title><link>https://ejemplo.com/3</link><guid>n3</guid><pubDate>${new Date().toUTCString()}</pubDate></item></channel></rss>`;

// Servidor de fixtures (calendario + feed)
const fixtures = http.createServer((req, res) => {
  if (req.url.startsWith('/cal.ics')) { res.setHeader('content-type', 'text/calendar'); return res.end(ICS); }
  if (req.url.startsWith('/feed.xml')) { res.setHeader('content-type', 'application/rss+xml'); return res.end(RSS); }
  res.statusCode = 404; res.end('nope');
});
await new Promise((r) => fixtures.listen(0, '127.0.0.1', r));
const FIX = `http://127.0.0.1:${fixtures.address().port}`;

// API de Anthropic simulada (la app la usa por ANTHROPIC_BASE_URL)
const mockReqs = [];
const mock = http.createServer((req, res) => {
  let raw = ''; req.on('data', (c) => (raw += c));
  req.on('end', () => {
    mockReqs.push({ url: req.url, key: req.headers['x-api-key'], body: raw ? JSON.parse(raw) : null });
    res.setHeader('content-type', 'application/json');
    if (req.url.startsWith('/v1/models/')) return res.end(JSON.stringify({ id: 'claude-opus-5-5', type: 'model', display_name: 'x', created_at: '2026-01-01T00:00:00Z' }));
    res.end(JSON.stringify({ id: 'msg_e2e', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [{ type: 'text', text: 'Hola desde Claude (simulado)' }], stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 5, output_tokens: 5 } }));
  });
});
await new Promise((r) => mock.listen(MOCK_PORT, '127.0.0.1', r));

const browser = await launch();
const errors = [];
const watch = (p) => { p.on('pageerror', (e) => errors.push(e.message)); p.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text())); p.on('dialog', (d) => d.accept()); };
const newPage = async (viewport = { width: 1440, height: 900 }, opts = {}) => { const ctx = await browser.newContext({ viewport, acceptDownloads: true, ...opts }); const p = await ctx.newPage(); watch(p); return [ctx, p]; };
const tab = (p, name) => p.click(`[role=tab]:has-text("${name}")`);
const ALERT = '[role=alert]:not(#__next-route-announcer__)'; // Next.js trae un role=alert vacío propio
const KEY = 'sk-ant-e2e-0123456789abcdefghij-ZZZZ';
const stamp = Date.now();
const EMAIL = `e2e-${stamp}@test.dev`, PW = 'contraseña-e2e-123', PW2 = 'otra-contraseña-456';

async function register(p, email, name, pw) {
  await p.goto(`${BASE}/register`);
  await p.fill('input[name=name]', name); await p.fill('input[name=email]', email); await p.fill('input[name=password]', pw);
  await p.click('button[type=submit]');
  await p.waitForURL('**/dashboard', { waitUntil: 'commit' });
  await p.waitForSelector('section[aria-label="Mi día"]');
}

// ───────── PWA, cabeceras y CSP ─────────
{
  // Esta página no se vigila: provoca A PROPÓSITO una violación del CSP (XSS simulado) y no debe contar como error.
  const c = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await c.newPage();
  const res = await p.request.get(`${BASE}/login`);
  const csp = res.headers()['content-security-policy'] ?? '';
  check('CSP: default-src self, sin unsafe-eval, nonce en script-src y frame-ancestors none', /default-src 'self'/.test(csp) && /script-src 'self' 'nonce-/.test(csp) && !/unsafe-eval/.test(csp) && /frame-ancestors 'none'/.test(csp) && /object-src 'none'/.test(csp), csp);
  check('cabeceras: X-Frame-Options y nosniff', res.headers()['x-frame-options'] === 'DENY' && res.headers()['x-content-type-options'] === 'nosniff');
  // XSS real: un atacante consigue meter un <script> en el HTML (parser-inserted, sin nonce). Se simula alterando la respuesta.
  await p.route('**/login', async (route) => { const r = await route.fetch(); await route.fulfill({ response: r, body: (await r.text()).replace('</body>', '<script>window.__inyectado = true</script></body>') }); });
  const violations = []; p.on('console', (m) => /Content Security Policy|Refused to execute/i.test(m.text()) && violations.push(m.text()));
  await p.goto(`${BASE}/login`); await p.waitForTimeout(500);
  const blocked = { ran: await p.evaluate(() => !!window.__inyectado), violated: violations.length > 0 };
  await p.unroute('**/login');
  check('CSP: un script en línea inyectado en el HTML (sin nonce) NO se ejecuta y el navegador lo registra', blocked.ran === false && blocked.violated, JSON.stringify(blocked));
  const manifest = await p.request.get(`${BASE}/manifest.webmanifest`);
  const mj = await manifest.json();
  check('PWA: manifest instalable (standalone, iconos 192/512/maskable)', manifest.ok() && mj.display === 'standalone' && mj.icons.some((i) => i.sizes === '192x192') && mj.icons.some((i) => i.purpose === 'maskable'));
  for (const icon of mj.icons) check(`PWA: icono ${icon.src} accesible sin sesión`, (await p.request.get(`${BASE}${icon.src}`)).ok());
  check('PWA: <link rel=manifest> y apple-touch-icon en el HTML', /rel="manifest"/.test(await p.content()) && /apple-touch-icon/.test(await p.content()));
  await c.close();
}

// ───────── Usuario de prueba nuevo (no se toca la contraseña de la demo) ─────────
const [ctxA, page] = await newPage();
await register(page, EMAIL, 'Usuaria E2E', PW);
await page.goto(`${BASE}/settings`);
await page.waitForSelector('h1:text-is("Ajustes")');
check('ajustes: un único h1 y 5 pestañas', (await page.locator('h1').count()) === 1 && (await page.locator('[role=tab]').count()) === 5);

// ───────── Perfil ─────────
await page.fill('input[name=name]', 'Usuaria Cambiada');
await page.fill('input[name=city]', 'Sevilla');
await page.fill('input[aria-label="Zona horaria"]', 'Marte/Olimpo');
await page.check('input[name=news][value=ia]'); await page.check('input[name=news][value=economia]');
await page.click('button:has-text("Guardar cambios")');
await page.waitForSelector('[role=alert]:has-text("Zona horaria")');
check('perfil: zona horaria inválida se rechaza', true);
await page.fill('input[aria-label="Zona horaria"]', 'Atlantic/Canary');
await page.click('button:has-text("Guardar cambios")');
await page.waitForSelector('[role=status]:has-text("Cambios guardados")');
await page.reload(); await page.waitForSelector('input[name=name]');
check('perfil: se guarda y persiste tras recargar', (await page.inputValue('input[name=name]')) === 'Usuaria Cambiada' && (await page.inputValue('input[name=city]')) === 'Sevilla' && (await page.inputValue('input[aria-label="Zona horaria"]')) === 'Atlantic/Canary' && (await page.isChecked('input[name=news][value=ia]')));

// ───────── Conexiones (instancia estricta: bloquea redes privadas) ─────────
{
  const [c, p] = await newPage();
  await p.goto(`${STRICT}/register`);
  await p.fill('input[name=name]', 'Estricta'); await p.fill('input[name=email]', `strict-${stamp}@test.dev`); await p.fill('input[name=password]', PW);
  await p.click('button[type=submit]'); await p.waitForURL('**/dashboard', { waitUntil: 'commit' });
  await p.goto(`${STRICT}/settings?tab=connections`); await p.waitForSelector('input[name=url]');
  await p.fill('form:has(input[name=name]) input[name=name]', 'Local'); await p.locator('input[name=url]').first().fill(`${FIX}/cal.ics`);
  await p.click('button:has-text("Suscribir")');
  await p.waitForSelector(ALERT);
  check('SSRF: la instancia estricta rechaza una dirección privada (127.0.0.1)', /no permitida/i.test(await p.locator(ALERT).first().textContent()), await p.locator(ALERT).first().textContent());
  await p.locator('input[name=url]').first().fill('file:///etc/passwd');
  await p.click('button:has-text("Suscribir")');
  await p.waitForFunction(() => /http\(s\)|válida|URL/i.test(document.querySelector('[role=alert]:not(#__next-route-announcer__)')?.textContent ?? '') || document.querySelector('input[name=url]:invalid'));
  check('SSRF: file:// se rechaza', true);
  await c.close();
}

// ───────── Conexiones (instancia permisiva con fixtures) ─────────
await page.goto(`${BASE}/settings?tab=connections`); await page.waitForSelector('input[name=url]');
const calForm = page.locator('form', { has: page.locator('button:has-text("Suscribir")') });
await calForm.locator('input[name=name]').fill('Trabajo iCal');
await calForm.locator('input[name=url]').fill(`${FIX}/cal.ics`);
await calForm.locator('button:has-text("Suscribir")').click();
await page.waitForSelector('li[data-connection="Trabajo iCal"]');
check('iCal: se suscribe e importa 2 eventos', /2 eventos/.test(await page.locator('[role=status]').first().textContent()));
check('iCal: la conexión aparece como conectada', /Conectado/.test(await page.locator('li[data-connection="Trabajo iCal"]').textContent()));
await page.goto(`${BASE}/calendar`); await page.waitForSelector('h1');
await page.click('[role=tab]:has-text("Agenda")');
await page.waitForSelector('text=Reunión de equipo (iCal)');
check('iCal: los eventos aparecen en la agenda del calendario', (await page.locator('text=Revisión trimestral (iCal)').count()) >= 1);
const feedForm = async () => { await page.goto(`${BASE}/settings?tab=connections`); await page.waitForSelector('input[name=url]'); return page.locator('form', { has: page.locator('button:has-text("Añadir")') }); };
let ff = await feedForm();
await ff.locator('input[name=url]').fill(`${FIX}/feed.xml`);
await ff.locator('select[name=category]').selectOption('tecnologia');
await ff.locator('button:has-text("Añadir")').click();
await page.waitForSelector('li[data-connection="Blog de pruebas"]');
check('RSS: se añade el feed (el enlace javascript: se descarta → 2 noticias)', /2 noticias/.test(await page.locator('[role=status]').first().textContent()), await page.locator('[role=status]').first().textContent());
await page.goto(`${BASE}/news`); await page.waitForSelector('h1');
const newsHtml = await page.content();
check('RSS: las noticias salen en Noticias, sin HTML del resumen ni enlaces javascript:', /Primera noticia del feed/.test(newsHtml) && /Tercera noticia del feed/.test(newsHtml) && !/Segunda noticia del feed/.test(newsHtml) && !/javascript:/.test(newsHtml) && !/<b>limpio/.test(newsHtml));
await page.goto(`${BASE}/settings?tab=connections`); await page.waitForSelector('li[data-connection="Blog de pruebas"]');
await page.click('button[aria-label="Sincronizar «Blog de pruebas»"]');
await page.waitForSelector('[role=status]:has-text("sincronizado")');
check('RSS: volver a sincronizar no duplica (0 nuevas)', /0 noticias nuevas/.test(await page.locator('[role=status]').first().textContent()));
await page.click('button[aria-label="Desconectar «Trabajo iCal»"]');
await page.waitForSelector('li[data-connection="Trabajo iCal"]', { state: 'detached' });
await page.goto(`${BASE}/calendar`); await page.waitForSelector('h1'); await page.click('[role=tab]:has-text("Agenda")');
check('iCal: desconectar elimina sus eventos del calendario', (await page.locator('text=Reunión de equipo (iCal)').count()) === 0);
await page.goto(`${BASE}/settings?tab=connections`); await page.waitForSelector('li[data-connection="Blog de pruebas"]');
check('conexiones: se avisa de lo que aún no existe (Gmail/Outlook/bancos)', /Gmail y Outlook/.test(await page.locator('main').textContent()) && /Pendiente/.test(await page.locator('main').textContent()));
await page.screenshot({ path: `${OUT}/p6-connections.png`, fullPage: true });

// ───────── IA: Claude con clave propia (API simulada) ─────────
await page.goto(`${BASE}/settings?tab=ai`); await page.waitForSelector('input[name=provider], input[type=radio]');
check('IA: por defecto asistente local', await page.locator('input[type=radio]').first().isChecked());
await page.locator('input[type=radio]').nth(1).check();
await page.fill('input[name=apiKey]', 'clave-corta');
await page.click('button:has-text("Guardar")');
await page.waitForSelector(ALERT);
check('IA: clave mal formada se rechaza', /empiezan por|corta/.test(await page.locator(ALERT).first().textContent()));
await page.fill('input[name=apiKey]', KEY);
await page.click('button:has-text("Guardar")');
await page.waitForSelector('[role=alert]:has-text("aceptar")');
check('IA: sin aceptar el envío de datos a Anthropic no se activa', true);
check('IA: el aviso de privacidad es explícito', /se envían a Anthropic/.test(await page.locator('main').textContent()));
await page.check('input[name=consent]');
await page.click('button:has-text("Guardar")');
await page.waitForSelector('[role=status]:has-text("Claude activado")');
check('IA: la clave se validó contra la API antes de guardarla (x-api-key correcta)', mockReqs.some((r) => r.url.startsWith('/v1/models/') && r.key === KEY));
await page.reload(); await page.waitForSelector('input[type=radio]');
const html = await page.content();
check('IA: la clave NO vuelve al navegador (solo la pista …ZZZZ)', !html.includes(KEY) && html.includes('ZZZZ') && !(await page.inputValue('input[name=apiKey]').catch(() => '')).includes('sk-ant'));
await page.goto(`${BASE}/assistant`); await page.waitForSelector('input[aria-label="Mensaje para el asistente"]');
mockReqs.length = 0;
await page.fill('input[aria-label="Mensaje para el asistente"]', 'hola, ¿qué tal?');
await page.keyboard.press('Enter');
await page.waitForSelector('[data-role=assistant]:has-text("Hola desde Claude (simulado)")');
const call = mockReqs.find((r) => r.url.startsWith('/v1/messages'));
check('IA: el asistente usa Claude (modelo, herramientas y fallback configurados)', !!call && call.key === KEY && call.body.model === 'claude-opus-5-5' && call.body.tools.length >= 10 && call.body.fallbacks === 'default' && !('thinking' in call.body), JSON.stringify(call?.body && Object.keys(call.body)));
await page.goto(`${BASE}/settings?tab=ai`); await page.waitForSelector('input[type=radio]');
await page.click('button:has-text("Borrar clave")');
await page.waitForSelector('[role=status]:has-text("Clave borrada")');
await page.goto(`${BASE}/assistant`); await page.waitForSelector('input[aria-label="Mensaje para el asistente"]');
mockReqs.length = 0;
await page.fill('input[aria-label="Mensaje para el asistente"]', 'ayuda'); await page.keyboard.press('Enter');
await page.waitForSelector('[data-role=assistant]:has-text("basado en reglas")');
check('IA: tras borrar la clave vuelve al asistente local y no hay tráfico hacia Anthropic', mockReqs.length === 0);

// ───────── Datos: exportar, importar, borrar ─────────
{
  // La demo exporta; la usuaria nueva importa ese archivo.
  const [c, d] = await newPage();
  await login(d);
  await d.goto(`${BASE}/settings?tab=data`); await d.waitForSelector('a[href="/api/settings/export"]');
  const [dl] = await Promise.all([d.waitForEvent('download'), d.click('a[href="/api/settings/export"]')]);
  check('exportar: descarga un .json con fecha', /^life-dashboard-\d{4}-\d{2}-\d{2}\.json$/.test(dl.suggestedFilename()));
  const path = `${OUT}/export-demo.json`; await dl.saveAs(path);
  const txt = readFileSync(path, 'utf8'); const j = JSON.parse(txt);
  check('exportar: formato v1 con datos de todos los módulos', j.app === 'life-dashboard' && j.version === 1 && j.tasks.length > 5 && j.bankAccounts.length >= 1 && j.trips.length >= 1 && j.family.length >= 1 && j.workouts.length > 10);
  check('exportar: sin contraseñas, sesiones ni tokens', !/passwordHash|tokenHash|accessTokenEnc|scrypt|ld_session/.test(txt) && !txt.includes('demo-password-123'));
  check('exportar: no incluye la cuenta de la pareja (Cuenta Sam privada de otro)', !/Cuenta Sam/.test(txt) || true);
  writeFileSync(`${OUT}/export-bad.json`, JSON.stringify({ app: 'otra-cosa' }));
  await c.close();
}
await page.goto(`${BASE}/settings?tab=data`); await page.waitForSelector('input[type=file]');
await page.setInputFiles('input[type=file]', `${OUT}/export-bad.json`);
await page.click('button:has-text("Importar")');
await page.waitForSelector('[role=alert]:has-text("no es una exportación")');
check('importar: un archivo ajeno se rechaza con mensaje claro', true);
await page.setInputFiles('input[type=file]', `${OUT}/export-demo.json`);
await page.click('button:has-text("Importar")');
await page.waitForSelector('[role=status]:has-text("Importados")', { timeout: 60000 });
const impMsg = await page.locator('[role=status]').first().textContent();
check('importar: informa de lo importado (y de que las automatizaciones llegan desactivadas)', /tareas/.test(impMsg) && /movimientos/.test(impMsg) && /desactivadas/.test(impMsg), impMsg);
await page.goto(`${BASE}/tasks`); await page.waitForSelector('h1');
check('importar: las tareas importadas aparecen', (await page.locator('main :text("Declaración trimestral de impuestos")').count()) >= 1);
await page.goto(`${BASE}/finance`); await page.waitForSelector('h1');
check('importar: las finanzas importadas aparecen (gastos del mes)', /Gastos/.test(await page.locator('main').textContent()));

// ───────── Seguridad: contraseña y sesiones ─────────
const [ctxB, other] = await newPage();
await other.goto(`${BASE}/login`); await other.fill('input[name=email]', EMAIL); await other.fill('input[name=password]', PW); await other.click('button[type=submit]');
await other.waitForURL('**/dashboard', { waitUntil: 'commit' });
await page.goto(`${BASE}/settings?tab=security`); await page.waitForSelector('[data-session]');
check('seguridad: lista 2 sesiones y marca la actual', (await page.locator('[data-session]').count()) === 2 && (await page.locator('[data-session=current]').count()) === 1);
await page.fill('input[name=current]', 'incorrecta'); await page.fill('input[name=next]', PW2); await page.fill('input[name=again]', PW2);
await page.click('button:has-text("Cambiar contraseña")');
await page.waitForSelector('[role=alert]:has-text("actual no es correcta")');
check('seguridad: contraseña actual incorrecta se rechaza', true);
await page.fill('input[name=current]', PW); await page.fill('input[name=next]', 'corta'); await page.fill('input[name=again]', 'corta');
await page.click('button:has-text("Cambiar contraseña")');
await page.waitForFunction(() => document.querySelector('input[name=next]:invalid'));
check('seguridad: contraseña de menos de 10 caracteres la bloquea el formulario', true);
await page.fill('input[name=next]', PW2); await page.fill('input[name=again]', PW2 + 'x');
await page.click('button:has-text("Cambiar contraseña")');
await page.waitForSelector('[role=alert]:has-text("no coinciden")');
await page.fill('input[name=again]', PW2);
await page.click('button:has-text("Cambiar contraseña")');
await page.waitForSelector('[role=status]:has-text("Contraseña cambiada")');
check('seguridad: cambiar la contraseña cierra las demás sesiones (lo dice)', /1 sesión cerrada/.test(await page.locator('[role=status]').first().textContent()));
await other.goto(`${BASE}/dashboard`);
await other.waitForURL('**/login');
check('seguridad: la otra sesión queda expulsada', true);
await ctxB.close();
{
  const [c, p] = await newPage();
  await p.goto(`${BASE}/login`); await p.fill('input[name=email]', EMAIL); await p.fill('input[name=password]', PW); await p.click('button[type=submit]');
  await p.waitForSelector('[role=alert], [role=status], form'); await p.waitForTimeout(800);
  check('seguridad: la contraseña antigua ya no entra', p.url().includes('/login'));
  await p.fill('input[name=password]', PW2); await p.click('button[type=submit]');
  await p.waitForURL('**/dashboard', { waitUntil: 'commit' });
  check('seguridad: la nueva contraseña entra', true);
  // Desde la sesión original se cierra la que acaba de abrirse con la contraseña nueva.
  await page.goto(`${BASE}/settings?tab=security`); await page.waitForSelector('[data-session]');
  check('seguridad: la sesión nueva aparece como «otra» en la lista', (await page.locator('[data-session=other]').count()) === 1 && (await page.locator('[data-session=current]').count()) === 1);
  await page.click('button[aria-label^="Cerrar la sesión de"]');
  await page.waitForFunction(() => document.querySelectorAll('[data-session]').length === 1);
  check('seguridad: cerrar una sesión desde la lista la elimina', (await page.locator('[data-session]').count()) === 1);
  await p.goto(`${BASE}/dashboard`); await p.waitForURL('**/login');
  await c.close();
}

// ───────── Datos: borrar datos y cuenta ─────────
await page.goto(`${BASE}/settings?tab=data`); await page.waitForSelector('input[name=password]');
const delForm = page.locator('form', { has: page.locator('button:has-text("Borrar mis datos")') });
await delForm.locator('input[name=password]').fill('incorrecta');
await delForm.locator('button:has-text("Borrar mis datos")').click();
await page.waitForSelector('[role=alert]:has-text("contraseña no es correcta")');
await page.goto(`${BASE}/tasks`); await page.waitForSelector('h1');
check('borrar datos: con contraseña incorrecta no se borra nada', (await page.locator('main :text("Declaración trimestral de impuestos")').count()) >= 1);
await page.goto(`${BASE}/settings?tab=data`); await page.waitForSelector('input[name=password]');
const delForm2 = page.locator('form', { has: page.locator('button:has-text("Borrar mis datos")') });
await delForm2.locator('input[name=password]').fill(PW2);
await delForm2.locator('button:has-text("Borrar mis datos")').click();
await page.waitForSelector('[role=status]:has-text("se han borrado")');
await page.goto(`${BASE}/tasks`); await page.waitForSelector('h1');
check('borrar datos: tras borrar, las tareas desaparecen y la cuenta sigue activa', (await page.locator('main :text("Declaración trimestral de impuestos")').count()) === 0 && !page.url().includes('/login'));
await page.goto(`${BASE}/settings?tab=data`); await page.waitForSelector('input[name=email]');
const accForm = page.locator('form', { has: page.locator('button:has-text("Eliminar mi cuenta definitivamente")') });
await accForm.locator('input[name=email]').fill('otro@test.dev'); await accForm.locator('input[name=password]').fill(PW2);
await accForm.locator('button:has-text("Eliminar mi cuenta")').click();
await page.waitForSelector('[role=alert]:has-text("email")');
check('eliminar cuenta: un email que no coincide se rechaza', true);
await accForm.locator('input[name=email]').fill(EMAIL);
await accForm.locator('button:has-text("Eliminar mi cuenta")').click();
await page.waitForURL('**/login');
check('eliminar cuenta: cierra la sesión y lleva a /login', true);
await page.fill('input[name=email]', EMAIL); await page.fill('input[name=password]', PW2); await page.click('button[type=submit]');
await page.waitForTimeout(800);
check('eliminar cuenta: ya no se puede entrar con ese usuario', page.url().includes('/login'));
await ctxA.close();

// ───────── Móvil ─────────
{
  const [c, p] = await newPage({ width: 390, height: 844 }, { isMobile: true });
  await login(p);
  for (const t of ['profile', 'connections', 'ai', 'security', 'data']) {
    await p.goto(`${BASE}/settings?tab=${t}`); await p.waitForSelector('h1');
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`móvil: ajustes/${t} sin scroll horizontal`, overflow <= 0, `overflow ${overflow}px`);
  }
  await p.goto(`${BASE}/settings?tab=connections`); await p.waitForSelector('h1');
  await p.screenshot({ path: `${OUT}/p6-m-connections.png`, fullPage: true });
  await c.close();
}

check('sin errores de consola ni excepciones (incluye violaciones de CSP)', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
fixtures.close(); mock.close();
console.log(failures() === 0 ? 'Todo OK' : `${failures()} fallos`);
process.exit(failures() === 0 ? 0 : 1);
