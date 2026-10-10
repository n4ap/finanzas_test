import 'server-only';
import { runScheduledTick } from './scheduled';

const FIRST_DELAY_MS = 60_000; // deja arrancar el servidor antes de la primera pasada
const EVERY_MS = 30 * 60_000;

/**
 * Planificador interno: mientras la app esté abierta, cada 30 minutos sincroniza, evalúa automatizaciones y hace las
 * tareas diarias pendientes (precios y copia). Pensado para uso personal en un solo servidor; con varias instancias,
 * usa SCHEDULER=off y un cron externo contra /api/automations/run (las tareas diarias no se duplican gracias a JobRun).
 */
export function startScheduler() {
  const g = globalThis as { __lifedashScheduler?: boolean };
  if (g.__lifedashScheduler) return; // el modo dev recarga módulos: un solo planificador por proceso
  g.__lifedashScheduler = true;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const r = await runScheduledTick();
      if (r.prices || r.backups || r.fired || r.errors) console.log('[planificador]', JSON.stringify(r));
    } catch (e) { console.error('[planificador]', e); } finally { running = false; }
  };
  setTimeout(() => { void tick(); setInterval(() => void tick(), EVERY_MS).unref(); }, FIRST_DELAY_MS).unref();
}
