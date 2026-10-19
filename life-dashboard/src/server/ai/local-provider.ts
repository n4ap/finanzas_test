/* eslint-disable @typescript-eslint/no-explicit-any -- los resultados de las herramientas llegan como JSON (frontera sin tipos): el proveedor los lee de forma defensiva */
import { formatEURExact, formatNumber } from '@/lib/utils';
import { parseWhen } from '@/lib/nlp-es';
import { fmtLocalDay, localKey, localToUtc } from '@/lib/tz';
import type { AIContext, AIMessageDTO, AIProvider, AIToolCall } from '../providers/types';

/**
 * Proveedor local: un enrutador de intenciones por reglas (sin LLM, sin red). Cumple el mismo contrato que un LLM real:
 * primero pide herramientas, luego redacta la respuesta con sus resultados. Los datos nunca salen del servidor.
 * Función pura de (contexto, historial): se prueba sin base de datos.
 */

const fold = (s: string) => s.toLowerCase().replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e').replace(/[íìï]/g, 'i').replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u').replace(/ñ/g, 'n');
const has = (f: string, re: RegExp) => re.test(f);

export const HELP = [
  'Puedo consultar y organizar tu información. Prueba con:',
  '- **Consultas**: «¿Qué tengo mañana?», «tareas atrasadas», «¿cuánto he gastado este mes?», «próximos pagos», «cómo van mis inversiones», «mi salud», «mis viajes», «próximos cumpleaños», «¿qué es lo más importante?», «emails por responder».',
  '- **Acciones** (siempre te pido confirmación): «crea una tarea llamar al dentista el viernes», «reunión con Marta mañana a las 10», «añade leche y pan a la compra», «completa la tarea de impuestos», «organízame la semana».',
  '- **Coach**: «¿cómo voy?» (tu dashboard personal), «revisión semanal», «mis objetivos», «analiza mi decisión «…»».',
  'Soy un asistente local basado en reglas (no un modelo de lenguaje): entiendo frases sencillas y no envío tus datos fuera.',
].join('\n');

type Intent = 'coach_panel' | 'coach_review' | 'coach_goals' | 'coach_decision' | 'greeting' | 'complete' | 'shopping' | 'event' | 'task_create' | 'weekplan' | 'priorities' | 'birthdays' | 'trips' | 'health' | 'portfolio' | 'payments' | 'spending' | 'emails' | 'tasks' | 'agenda' | 'unknown';

export function detectIntent(text: string): Intent {
  const f = fold(text).trim();
  if (has(f, /\b(completa|completar|termina|terminar|finaliza)\b/) || has(f, /\bmarca\w*\b.*\b(hecha|hecho|completada|terminada)\b/) || has(f, /\b(he|ya he)\s+(terminado|hecho)\b/)) return 'complete';
  if (has(f, /\b(anade|anadir|apunta|apuntar|pon|poner|mete|agrega|agregar)\b.+\b(a|en|de) la (lista de la )?compra\b/)) return 'shopping';
  if (has(f, /\b(crea|crear|agenda|agendar|programa|programar|pon|poner|anade|anadir|apunta|apuntar|nueva|nuevo)\b.*\b(evento|reunion|cita|llamada)\b/) || has(f, /^(evento|reunion|cita)\b/)) return 'event';
  if (has(f, /\b(crea|crear|anade|anadir|apunta|apuntar|anota|anotar|nueva)\b.*\btarea\b/) || has(f, /\b(recuerdame|recordarme)\b/)) return 'task_create';
  if (has(f, /\b(organiza|organizame|planifica|planificame|prepara|reparte)\b.*\bsemana\b/)) return 'weekplan';
  if (has(f, /\b(analiza\w*|ayudame con|ayudame a tomar)\b.*\b(decision|decidir|dilema)\b/) || has(f, /\bmi decision\b/)) return 'coach_decision';
  if (has(f, /\brevision (semanal|diaria|mensual|de la semana|del mes)\b/) || has(f, /\b(revisa|repasa|analiza)\w* (mi|la) (semana|mes)\b/) || has(f, /\bcomo (me )?ha ido (la|mi|esta) semana\b/)) return 'coach_review';
  if (has(f, /\b(mis objetivos|objetivos de 90|mis metas)\b/)) return 'coach_goals';
  if (has(f, /\b(como voy|mi situacion|resumen de mi (vida|situacion|semana)|mi dashboard|dashboard personal|mapa (personal|de vida)|coach)\b/)) return 'coach_panel';
  if (has(f, /\b(prioridad|prioridades|importante|urgente|urgentes)\b/) || has(f, /\bque (deberia|debo|hago)\b/) || has(f, /\bsiguiente accion\b/)) return 'priorities';
  if (has(f, /\bcumple/)) return 'birthdays';
  if (has(f, /\b(viaje|viajes|maleta|vuelo)\b/)) return 'trips';
  if (has(f, /\b(salud|entreno|entrenos|entrenamiento|peso|sueno|pasos|deporte)\b/)) return 'health';
  if (has(f, /\b(inversion|inversiones|cartera|bolsa|rentabilidad|acciones|etf)\b/)) return 'portfolio';
  if (has(f, /\b(pagos|recibos|cargos)\b/) || has(f, /\bproxim\w* pago\b/)) return 'payments';
  if (has(f, /\b(gast\w*|presupuesto\w*|dinero|ahorr\w*|ingres\w*)\b/)) return 'spending';
  if (has(f, /\b(email|emails|correo|correos|mail|mails|bandeja)\b/)) return 'emails';
  if (has(f, /\b(tarea|tareas|pendientes|pendiente)\b/)) return 'tasks';
  if (has(f, /\b(agenda|calendario|reunion|reuniones|evento|eventos|tengo|manana|hoy|semana|cita|citas)\b/)) return 'agenda';
  if (has(f, /^(hola|buenas|buenos dias|buenas tardes|gracias|ok|vale)\b/)) return 'greeting';
  return 'unknown';
}

// ───────── Extracción de argumentos ─────────

const stripLead = (s: string) => s.replace(/^\s*(?:por favor,?\s*)?(?:(?:me\s+)?(?:crea|crear|añade|añadir|anade|anadir|apunta|apuntar|anota|anotar|programa|programar|agenda|agendar|pon|poner|recuérdame|recuerdame|recordarme|nueva|nuevo)\s*)+(?:(?:una|un|el|la)\s+)?(?:nueva\s+)?(?:tarea|evento|cita|llamada)?\s*(?:(?:para|de|:|que)\s+)?/i, '').trim();

function taskArgs(text: string, ctx: AIContext) {
  const w = parseWhen(text, ctx.now, ctx.tzOffset);
  let title = stripLead(w.rest).replace(/^(?:que\s+)/i, '');
  const urgent = /\b(urgente|importante)\b/i.test(text);
  if (urgent) title = title.replace(/\b(urgente|importante)\b/gi, '').replace(/\s+/g, ' ').trim();
  title = title.charAt(0).toUpperCase() + title.slice(1);
  return { title: title.slice(0, 200), dueDate: w.dateKey, priority: urgent ? 1 : 2 };
}

function eventArgs(text: string, ctx: AIContext) {
  const w = parseWhen(text, ctx.now, ctx.tzOffset);
  let title = w.rest.replace(/^\s*(?:por favor,?\s*)?(?:(?:me\s+)?(?:crea|crear|añade|añadir|anade|anadir|programa|programar|agenda|agendar|pon|poner|apunta|apuntar)\s*)+(?:(?:un|una|el|la)\s+)?(?:nuevo\s+)?(?:evento|cita)?\s*(?:(?:de|para|:)\s+)?/i, '').trim();
  title = title || 'Evento';
  title = title.charAt(0).toUpperCase() + title.slice(1);
  return { title: title.slice(0, 200), dateKey: w.dateKey, time: w.time };
}

function shoppingItems(text: string): string[] {
  const m = /(?:añade|añadir|anade|anadir|apunta|apuntar|pon|poner|mete|agrega|agregar)\s+(.+?)\s+(?:a|en|de) la (?:lista de la )?compra/i.exec(text);
  if (!m) return [];
  return m[1]!.split(/\s*(?:,|\by\b)\s*/i).map((x) => x.replace(/^(?:un|una|unos|unas|el|la|los|las)\s+/i, '').trim()).filter(Boolean).slice(0, 5).map((x) => x.charAt(0).toUpperCase() + x.slice(1));
}

const FILLER = /^(?:como|hecha|hecho|completada|completado|terminada|terminado|la|el|lo|esa|ese|tarea|de|del|que|me|por favor)\b[\s,:]*/i;
/** Texto que identifica la tarea: lo que sigue al verbo, sin muletillas iniciales ni «como hecha» final (las palabras internas se conservan para poder coincidir con el título). */
const completeQuery = (text: string) => {
  let q = text.replace(/^.*?\b(?:completa|completar|termina|terminar|finaliza|marca(?:r)?|he terminado|he hecho|ya he hecho|ya he terminado)\b/i, '').replace(/[¿?¡!.,]/g, ' ').trim();
  for (let prev = ''; prev !== q;) { prev = q; q = q.replace(FILLER, ''); }
  return q.replace(/\s+(?:como\s+)?(?:hecha|hecho|completada|completado|terminada|terminado)$/i, '').replace(/\s+/g, ' ').trim().slice(0, 100);
};

// ───────── Resultados de herramientas ─────────

interface ToolResult { name: string; data: any; error?: string }
const parseResults = (msgs: AIMessageDTO[]): ToolResult[] =>
  msgs.filter((m) => m.role === 'tool').map((m) => {
    try { const d = JSON.parse(m.content); return d && typeof d === 'object' && 'error' in d && Object.keys(d).length === 1 ? { name: m.toolName ?? '', data: null, error: String(d.error) } : { name: m.toolName ?? '', data: d }; }
    catch { return { name: m.toolName ?? '', data: null, error: 'Resultado no legible' }; }
  });

const call = (name: string, args: unknown, i = 0): AIToolCall => ({ id: `call_${name}_${i}`, name, args });
const eur = formatEUR2;
function formatEUR2(n: number) { return formatEURExact(Math.round(n * 100) / 100); }
const pct = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n * 100).toFixed(1).replace('.', ',')} %`;
const plural = (n: number, one: string, many: string) => `${formatNumber(n)} ${n === 1 ? one : many}`;
const CAT = (c: string) => c.charAt(0).toUpperCase() + c.slice(1);

function proposalText(results: ToolResult[]): string {
  const ok = results.filter((r) => r.data?.proposalId);
  const bad = results.filter((r) => r.error);
  const lines: string[] = [];
  if (ok.length) lines.push(`He preparado ${ok.length === 1 ? 'esta acción' : `${ok.length} acciones`}. **No se ejecuta${ok.length === 1 ? '' : 'n'} hasta que la${ok.length === 1 ? '' : 's'} confirmes** (botones de abajo).`);
  for (const r of bad) lines.push(`No he podido preparar la acción: ${r.error}`);
  return lines.join('\n');
}

// ───────── Redactores por intención ─────────

function composeRead(results: ToolResult[]): string {
  const r = results.find((x) => x.name !== '' && !x.error);
  const err = results.find((x) => x.error);
  if (!r) return err ? `No he podido consultarlo: ${err.error}` : 'No he obtenido datos.';
  const d = r.data;
  switch (r.name) {
    case 'get_agenda': {
      const lines: string[] = [];
      for (const day of d.days as any[]) {
        const items = [...day.events.map((e: any) => `- ${e.start}${e.end ? `–${e.end}` : ''} · ${e.title}${e.location ? ` (${e.location})` : ''}${e.important ? ' ⭐' : ''}`), ...day.tasksDue.map((t: any) => `- Tarea: ${t.title}`)];
        if (d.days.length === 1 || items.length) lines.push(`**${day.label}**`, ...(items.length ? items : ['- Nada programado.']));
      }
      if (d.conflicts.length) lines.push(`⚠ Conflictos de horario: ${d.conflicts.join('; ')}.`);
      return lines.join('\n') || 'No tienes nada programado en ese periodo.';
    }
    case 'list_tasks': {
      if (d.total === 0) return 'No tienes tareas que coincidan. 🎉';
      return [`Tienes ${plural(d.total, 'tarea', 'tareas')}${d.total > d.tasks.length ? ` (te muestro ${d.tasks.length})` : ''}:`, ...d.tasks.map((t: any) => `- ${t.title}${t.due ? ` · ${t.due}` : ''}${t.overdue ? ' · **atrasada**' : ''}${t.priority === 1 ? ' · prioridad alta' : ''}`)].join('\n');
    }
    case 'get_spending': {
      const lines = [`**${d.month}**: ingresos ${eur(d.income)}, gastos ${eur(d.expenses)}, ahorro ${eur(d.saving)}${d.income > 0 ? ` (${Math.round(d.savingRate * 100)} % de lo ingresado)` : ''}.`];
      if (d.topCategories.length) lines.push(`Donde más gastas: ${d.topCategories.slice(0, 3).map((c: any) => `${CAT(c.category)} ${eur(c.amount)}`).join(', ')}.`);
      for (const b of d.budgetAlerts) lines.push(`⚠ Presupuesto de ${b.category}: ${eur(b.spent)} de ${eur(b.budget)} (${b.status === 'over' ? 'superado' : 'casi agotado'}).`);
      if (d.movements === 0) return `No hay movimientos registrados en ${d.month}.`;
      return lines.join('\n');
    }
    case 'get_payments': return d.payments.length ? [`Próximos pagos (${eur(Math.abs(d.total))} en total):`, ...d.payments.map((p: any) => `- ${p.date}: ${p.description} · ${eur(Math.abs(p.amount))}`)].join('\n') : 'No tienes pagos programados en ese periodo.';
    case 'get_portfolio': return d.positions === 0 ? 'Aún no tienes posiciones registradas.' : [`Tu cartera vale ${eur(d.value)} (aportado ${eur(d.cost)}): ${d.pnl >= 0 ? 'ganancia' : 'pérdida'} de ${eur(Math.abs(d.pnl))} (${pct(d.pnlPct)}).`, `Distribución: ${d.allocation.map((a: any) => `${a.type} ${Math.round(a.pct * 100)} %`).join(', ')}.`, `Mejor: ${d.best.map((b: any) => `${b.symbol} ${pct(b.pnlPct)}`).join(', ')}. Peor: ${d.worst.map((b: any) => `${b.symbol} ${pct(b.pnlPct)}`).join(', ')}.`, `_${d.note}_`].join('\n');
    case 'get_health': {
      const s = d.summary;
      const lines: string[] = [];
      if (s.weight.last !== null) lines.push(`Peso: ${s.weight.last.toLocaleString('es-ES')} kg${s.weight.change30 !== null ? ` (${s.weight.change30 > 0 ? '+' : s.weight.change30 < 0 ? '−' : ''}${Math.abs(s.weight.change30).toLocaleString('es-ES')} kg en 30 días)` : ''}.`);
      if (s.steps.avg7 !== null) lines.push(`Pasos: media de ${formatNumber(s.steps.avg7)} al día (meta ${formatNumber(d.goals.steps)}).`);
      if (s.sleep.avg7 !== null) lines.push(`Sueño: media de ${s.sleep.avg7.toLocaleString('es-ES')} h (meta ${d.goals.sleep.toLocaleString('es-ES')} h).`);
      lines.push(`Entrenos esta semana: ${s.workouts.thisWeek} de ${s.workouts.target}.`);
      for (const n of s.notes) lines.push(`- ${n}`);
      lines.push('_Datos orientativos: no son consejo médico._');
      return lines.join('\n');
    }
    case 'get_trips': return d.trips.length ? d.trips.map((t: any) => `- **${t.name}** (${t.destination}): ${t.phase === 'ongoing' ? 'en curso' : t.daysUntil === 0 ? 'sale hoy' : `faltan ${plural(t.daysUntil, 'día', 'días')}`}${t.budget ? ` · gastado ${eur(t.spent)} de ${eur(t.budget)}` : ''}${t.packingPending ? ` · maleta: ${plural(t.packingPending, 'cosa pendiente', 'cosas pendientes')}` : ''}`).join('\n') : 'No tienes viajes próximos.';
    case 'get_birthdays': return d.birthdays.length ? ['Próximos cumpleaños:', ...d.birthdays.map((b: any) => `- ${b.name} cumple ${b.turning} ${b.daysUntil === 0 ? 'hoy' : b.daysUntil === 1 ? 'mañana' : `en ${plural(b.daysUntil, 'día', 'días')}`}`)].join('\n') : 'No hay cumpleaños próximos.';
    case 'get_priorities': return [d.nextAction.message, '', ...(d.priorities.length ? ['Lo más importante ahora:', ...d.priorities.slice(0, 5).map((p: any) => `- ${p.title} · ${p.detail}`)] : [])].join('\n').trim();
    case 'search_emails': return d.emails.length ? ['Emails:', ...d.emails.map((e: any) => `- ${e.from}: ${e.subject}${e.needsReply ? ' · **por responder**' : ''}${e.deadline ? ` · límite ${e.deadline}` : ''}`), '_Ábrelos en Email para ver el contenido._'].join('\n') : 'No he encontrado emails que coincidan.';
    default: return 'Hecho.';
  }
}


// ───────── Coach ─────────

const of10 = (n: any) => (typeof n === 'number' ? `${n}/10` : '—');
const COACH_PRO = '_Soy el asistente local por reglas: ordeno tus datos y aplico las reglas del coach. Para un análisis razonado y conversación libre, activa Claude en Ajustes → IA._';

function coachPanel(d: any): string {
  const p = d.panel;
  const lines = ['**🎯 OBJETIVOS**', p.goal ? `- Principal: ${p.goal.title}\n- Progreso: ${p.goal.progress} %\n- Próxima acción: ${p.goal.nextAction ?? 'sin definir'}` : '- Sin objetivo de 90 días. Defínelo en Coach → Objetivos.'];
  lines.push('**🏋️ SALUD**', `- Entrenamiento: ${p.health.workouts}`, `- Sueño: ${p.health.sleep ?? '—'}`, `- Recuperación: ${of10(p.health.recovery)}`);
  lines.push('**💰 FINANZAS** (este mes)', `- Ingresos: ${eur(p.finance.income)} · Gastos: ${eur(p.finance.expenses)} · Ahorro: ${eur(p.finance.saving)}`, `- Inversiones: ${eur(p.finance.investments)} · Patrimonio: ${eur(p.finance.netWorth)}`);
  lines.push('**💼 TRABAJO**', `- Prioridad: ${p.work.priority ?? '—'} · Proyectos activos: ${p.work.projects}`, `- Próxima acción: ${p.work.nextAction ?? '—'}`);
  lines.push('**🧠 MENTE**', p.mind ? `- Ánimo ${of10(p.mind.mood)} · Estrés ${of10(p.mind.stress)} · Energía ${of10(p.mind.energy)}` : '- Sin revisión diaria reciente.');
  lines.push('**❤️ RELACIONES**', `- Puntuación semanal: ${of10(p.relations.score)}${p.relations.nextBirthday ? ` · próximo cumpleaños: ${p.relations.nextBirthday.name}` : ''}`);
  lines.push('**📚 APRENDIZAJE**', p.learning.length ? p.learning.map((g: any) => `- ${g.title}${g.nextAction ? ` → ${g.nextAction}` : ''}`).join('\n') : '- Sin objetivos de crecimiento activos.');
  lines.push('**⚠️ ALERTAS**', d.insights.length ? d.insights.slice(0, 4).map((i: any) => `- ${i.title}`).join('\n') : '- Nada destacable.');
  lines.push('**🚀 PRIORIDADES**', d.focus.important.length ? d.focus.important.map((x: any, i: number) => `${i + 1}. ${x.title}`).join('\n') : '1. Elige 1-3 cosas importantes para hoy.');
  if (!d.interview.complete) lines.push('', `Para conocerte mejor, completa la entrevista inicial (${d.interview.answered}/${d.interview.total}) en **Coach → Mapa de vida**.`);
  return lines.join('\n');
}

function coachReview(d: any): string {
  const t = d.trends;
  if (!t) return ['Aún no hay revisiones semanales con puntuación. Hazla en **Coach → Revisiones → Semanal** (5-10 min): puntúa 10 áreas de 0 a 10 y responde 4 preguntas.', '', `Datos de estos 7 días: ${d.weekData.workouts}/${d.weekData.workoutTarget} entrenos, ${d.weekData.tasksDone} tareas hechas.`].join('\n');
  const areas = t.areas as any[];
  const good = areas.filter((a) => a.improving || (a.last ?? 0) >= 7).map((a) => `${a.area} (${a.last})`);
  const bad = areas.filter((a) => a.declining || (a.last ?? 10) <= 4).map((a) => `${a.area} (${a.last}${a.declining ? ', baja 3 semanas' : ''})`);
  const top = d.insights[0];
  return [
    `**Revisión de la semana** · media ${t.overall ?? '—'}/10`,
    `**Lo que ha funcionado:** ${good.length ? good.join(', ') : 'ninguna área destaca todavía'}.`,
    `**Lo que no ha funcionado:** ${bad.length ? bad.join(', ') : 'nada por debajo de 5'}.`,
    `**Lo que debes cambiar:** ${top ? `${top.title}. ${top.detail}` : 'mantén lo que funciona; no añadas objetivos nuevos.'}`,
    `**Tu prioridad de la próxima semana:** ${d.panel.goal?.nextAction ?? d.focus.now ?? 'define la próxima acción de tu objetivo principal'}.`,
    '', COACH_PRO,
  ].join('\n');
}

function coachGoals(d: any): string {
  const g = d.goals as any[];
  if (!g.length) return 'No tienes objetivos activos. Empieza por **3 objetivos de 90 días** medibles en **Coach → Objetivos** (o pídemelo: «crea un objetivo de 90 días…» si usas Claude).';
  const label: Record<string, string> = { vision: 'Visión', annual: '12 meses', quarterly: '90 días', weekly: 'Esta semana' };
  const lines: string[] = [];
  for (const lv of ['vision', 'annual', 'quarterly', 'weekly']) {
    const xs = g.filter((x) => x.level === lv);
    if (!xs.length) continue;
    lines.push(`**${label[lv]}**`, ...xs.map((x) => `- ${x.title}${lv === 'vision' ? '' : ` · ${x.progress} %${x.nextAction ? ` · próxima acción: ${x.nextAction}` : ' · ⚠ sin próxima acción'}`}`));
  }
  const warn = (d.insights as any[]).filter((i) => i.area === 'general').slice(0, 2);
  if (warn.length) lines.push('', ...warn.map((i) => `⚠ ${i.title}`));
  return lines.join('\n');
}

function coachDecision(d: any, text: string): string {
  const x = (d.decisions as any[])[0];
  if (!x) return `No encuentro esa decisión. Estructúrala en **Coach → Decisiones** (objetivo, opciones con ventajas, desventajas, riesgos y coste) y vuelve a pedírmelo${/«(.+)»/.exec(text) ? '' : ' con su nombre'}.`;
  const lines = [`**DECISIÓN:** ${x.title}`, `**OBJETIVO:** ${x.objective ?? '⚠ sin definir: ¿qué quieres conseguir?'}`, '**OPCIONES:**'];
  const gaps: string[] = [];
  for (const o of x.options as any[]) {
    lines.push(`- **${o.name}**`, `  - Ventajas: ${o.pros ?? '—'}`, `  - Desventajas: ${o.cons ?? '—'}`, `  - Riesgos: ${o.risks ?? '—'}`, `  - Coste: ${o.cost ?? '—'}`);
    for (const [k, l] of [['pros', 'ventajas'], ['cons', 'desventajas'], ['risks', 'riesgos'], ['cost', 'coste']] as const) if (!o[k]) gaps.push(`${l} de «${o.name}»`);
  }
  lines.push(`**IMPACTO:** ${x.impact ?? '⚠ sin valorar (corto, medio y largo plazo)'}`, `**RECOMENDACIÓN:** ${x.recommendation ?? 'pendiente'}`, `**PRÓXIMA ACCIÓN:** ${x.nextAction ?? '⚠ sin definir'}`);
  if (x.options.length < 2) gaps.push('una segunda opción (aunque sea «no hacer nada»)');
  if (gaps.length) lines.push('', `Antes de decidir, completa: ${gaps.slice(0, 5).join(', ')}.`);
  lines.push('', COACH_PRO);
  return lines.join('\n');
}

export const localProvider: AIProvider = {
  id: 'local',
  async respond({ ctx, history }) {
    const lastUser = history.map((m) => m.role).lastIndexOf('user');
    if (lastUser < 0) return { content: HELP, toolCalls: [] };
    const text = history[lastUser]!.content;
    const after = history.slice(lastUser + 1);
    const results = parseResults(after);
    const asked = new Set(after.flatMap((m) => m.toolCalls?.map((c) => c.name) ?? []));
    const intent = detectIntent(text);
    const f = fold(text);
    const today = localKey(ctx.now, ctx.tzOffset);

    // Segunda vuelta: ya hay resultados que redactar (o un siguiente paso por pedir).
    if (results.length > 0) {
      if (intent === 'complete') {
        if (!asked.has('complete_task')) {
          const list = results.find((r) => r.name === 'list_tasks');
          const tasks = (list?.data?.tasks ?? []) as { id: string; title: string }[];
          if (tasks.length === 1) return { content: '', toolCalls: [call('complete_task', { taskId: tasks[0]!.id })] };
          if (tasks.length === 0) return { content: `No encuentro ninguna tarea abierta que coincida con «${completeQuery(text)}».`, toolCalls: [] };
          return { content: ['Hay varias tareas que coinciden; dime cuál:', ...tasks.slice(0, 6).map((t) => `- ${t.title}`)].join('\n'), toolCalls: [] };
        }
        return { content: proposalText(results.filter((r) => r.name === 'complete_task')), toolCalls: [] };
      }
      if (intent === 'weekplan') {
        const plan = results.find((r) => r.name === 'plan_week');
        if (!asked.has('schedule_tasks') && plan?.data) {
          const items = (plan.data.plan as any[]).flatMap((p) => p.tasks.filter((t: any) => t.needsDate).map((t: any) => ({ taskId: t.id, dueDate: p.date }))).slice(0, 15);
          const text0 = weekText(plan.data);
          if (items.length) return { content: `${text0}\n\nPuedo asignar esas fechas a las ${items.length} tareas que aún no la tienen.`, toolCalls: [call('schedule_tasks', { items })] };
          return { content: text0, toolCalls: [] };
        }
        const prop = proposalText(results.filter((r) => r.name === 'schedule_tasks'));
        return { content: `${weekText(plan?.data)}\n\n${prop}`.trim(), toolCalls: [] };
      }
      if (intent.startsWith('coach_')) {
        const r = results.find((x) => x.name === 'get_coach');
        if (!r || r.error || !r.data) return { content: `No he podido consultar tu coach${r?.error ? `: ${r.error}` : ''}.`, toolCalls: [] };
        const c = intent === 'coach_review' ? coachReview(r.data) : intent === 'coach_goals' ? coachGoals(r.data) : intent === 'coach_decision' ? coachDecision(r.data, text) : coachPanel(r.data);
        return { content: c, toolCalls: [] };
      }
      if (['shopping', 'task_create', 'event'].includes(intent)) return { content: proposalText(results), toolCalls: [] };
      return { content: composeRead(results), toolCalls: [] };
    }

    // Primera vuelta: decidir qué herramientas llamar.
    switch (intent) {
      case 'coach_panel': case 'coach_review': case 'coach_goals': return { content: '', toolCalls: [call('get_coach', {})] };
      case 'coach_decision': {
        const m = /«([^»]{2,120})»/.exec(text) ?? /decision(?:\s+(?:de|sobre))?\s+(.{3,80})$/i.exec(fold(text));
        return { content: '', toolCalls: [call('get_coach', m ? { decision: m[1]!.trim() } : {})] };
      }
      case 'greeting': return { content: '¡Hola! Pregúntame por tu agenda, tareas, gastos… o pídeme que cree una tarea o un evento. Escribe «ayuda» para ver ejemplos.', toolCalls: [] };
      case 'agenda': {
        const w = parseWhen(text, ctx.now, ctx.tzOffset);
        if (/\bsemana\b/.test(f)) return { content: '', toolCalls: [call('get_agenda', { from: today, days: 7 })] };
        return { content: '', toolCalls: [call('get_agenda', { from: w.dateKey ?? today, days: 1 })] };
      }
      case 'tasks': return { content: '', toolCalls: [call('list_tasks', { filter: /atrasad|vencid/.test(f) ? 'overdue' : /\bhoy\b/.test(f) ? 'today' : /\bsemana\b/.test(f) ? 'week' : 'open' })] };
      case 'spending': {
        const prev = /mes pasado|anterior/.test(f);
        const key = prev ? (() => { const d = new Date(`${today.slice(0, 7)}-15T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 7); })() : undefined;
        return { content: '', toolCalls: [call('get_spending', key ? { month: key } : {})] };
      }
      case 'payments': return { content: '', toolCalls: [call('get_payments', { days: 14 })] };
      case 'portfolio': return { content: '', toolCalls: [call('get_portfolio', {})] };
      case 'health': return { content: '', toolCalls: [call('get_health', {})] };
      case 'trips': return { content: '', toolCalls: [call('get_trips', {})] };
      case 'birthdays': return { content: '', toolCalls: [call('get_birthdays', { days: 60 })] };
      case 'priorities': return { content: '', toolCalls: [call('get_priorities', {})] };
      case 'emails': return { content: '', toolCalls: [call('search_emails', { needsReply: /respond|contest|pendiente/.test(f) || undefined, limit: 5 })] };
      case 'weekplan': return { content: '', toolCalls: [call('plan_week', {})] };
      case 'complete': {
        const q = completeQuery(text);
        if (!q) return { content: '¿Qué tarea quieres completar? Dime parte de su nombre.', toolCalls: [] };
        return { content: '', toolCalls: [call('list_tasks', { filter: 'open', query: q, limit: 6 })] };
      }
      case 'shopping': {
        const items = shoppingItems(text);
        if (!items.length) return { content: '¿Qué quieres añadir a la compra?', toolCalls: [] };
        return { content: '', toolCalls: items.map((label, i) => call('add_shopping_item', { label }, i)) };
      }
      case 'task_create': {
        const a = taskArgs(text, ctx);
        if (!a.title) return { content: '¿Cómo quieres llamar a la tarea? Por ejemplo: «crea una tarea llamar al dentista el viernes».', toolCalls: [] };
        return { content: '', toolCalls: [call('create_task', a.dueDate ? a : { title: a.title, priority: a.priority })] };
      }
      case 'event': {
        const a = eventArgs(text, ctx);
        if (!a.dateKey) return { content: `¿Para qué día es «${a.title}»? Por ejemplo: «${a.title.toLowerCase()} mañana a las 10».`, toolCalls: [] };
        if (!a.time) return { content: `¿A qué hora es «${a.title}» (${fmtLocalDay(a.dateKey).toLowerCase()})? Por ejemplo: «a las 10».`, toolCalls: [] };
        const startsAt = localToUtc(a.dateKey, a.time, ctx.tzOffset);
        return { content: '', toolCalls: [call('create_event', { title: a.title, startsAt: startsAt.toISOString(), endsAt: new Date(startsAt.getTime() + 3_600_000).toISOString() })] };
      }
      default: return { content: HELP, toolCalls: [] };
    }
  },
};

function weekText(data: any): string {
  if (!data) return '';
  if (!data.plan.length) return 'No hay tareas abiertas que repartir esta semana. 🎉';
  const lines = ['**Propuesta para tu semana** (según prioridad, fechas límite y tus huecos del calendario):'];
  for (const p of data.plan) lines.push(`**${p.label}**`, ...p.tasks.map((t: any) => `- ${t.title} (${t.minutes} min)${t.overdue ? ' · atrasada' : ''}`));
  if (data.unplaced.length) lines.push(`No he podido encajar: ${data.unplaced.join(', ')}.`);
  return lines.join('\n');
}
