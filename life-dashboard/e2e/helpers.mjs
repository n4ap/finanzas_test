import { chromium } from 'playwright-core';

export const BASE = process.env.BASE_URL ?? 'http://localhost:3100';
export const OUT = process.env.SHOTS ?? '/tmp/claude-0/shots';
let failed = 0;
export const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${ok ? '' : extra}`); if (!ok) failed++; };
export const failures = () => failed;

export async function launch() {
  return chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
}

export async function login(page, email = 'demo@lifedashboard.dev', password = 'demo-password-123') {
  await page.goto(`${BASE}/login`);
  await page.fill('input[name=email]', email);
  await page.fill('input[name=password]', password);
  await page.click('button[type=submit]');
  await page.waitForURL('**/dashboard', { waitUntil: 'commit' });
  await page.waitForSelector('section[aria-label="Mi día"]');
}

/** Abre la búsqueda global (Ctrl+K). Si la página aún no ha hidratado la pulsación se pierde: se reintenta hasta que aparece el diálogo. */
export async function openSearch(page) {
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Control+k');
    try { await page.waitForSelector('[role=dialog] input:focus', { timeout: 1500 }); return; } catch { /* reintentar */ }
  }
  throw new Error('No se pudo abrir la búsqueda global con Ctrl+K');
}
