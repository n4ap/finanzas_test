/**
 * Análisis de email determinista (sin LLM): clasifica, resume, detecta fechas límite, extrae tareas y redacta borradores.
 * Todo ocurre en local: el contenido del correo no sale del servidor. Un AIProvider real podrá sustituirlo (Fase 6).
 */
const WEEKDAYS: Record<string, number> = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
const MONTHS: Record<string, number> = { enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6, agosto: 7, septiembre: 8, setiembre: 8, octubre: 9, noviembre: 10, diciembre: 11 };

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
const atEndOfWorkday = (d: Date, h = 18, m = 0) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
const DEADLINE_CUE = /(antes d[eel]|hasta (el|este)?|para (el|este)?|como (mucho|maximo)|limite|vence|vencimiento|plazo|a mas tardar|no mas tarde)/;

function parseTime(text: string): [number, number] | null {
  const m = norm(text).match(/(?:a las |sobre las )?(\d{1,2})[:h](\d{2})\b/) ?? norm(text).match(/a las (\d{1,2})\b/);
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2] ?? 0);
  return h < 24 && min < 60 ? [h, min] : null;
}

/** Fecha límite mencionada en el texto, relativa a `now`. Devuelve null si no hay una señal clara. */
export function extractDeadline(text: string, now: Date): Date | null {
  const t = norm(text);
  const sentences = t.split(/(?<=[.!?\n])\s+/);
  for (const s of sentences) {
    const cued = DEADLINE_CUE.test(s);
    const tm = parseTime(s);
    const build = (d: Date) => (tm ? atEndOfWorkday(d, tm[0], tm[1]) : atEndOfWorkday(d));

    const num = s.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
    if (num && (cued || /\b(fecha|dia)\b/.test(s))) {
      const day = Number(num[1]), mon = Number(num[2]) - 1;
      let y = num[3] ? Number(num[3]) : now.getFullYear();
      if (y < 100) y += 2000;
      let d = new Date(y, mon, day);
      if (!num[3] && d < new Date(now.getFullYear(), now.getMonth(), now.getDate())) d = new Date(y + 1, mon, day);
      if (d.getMonth() === mon) return build(d);
    }
    const longDate = s.match(/\b(\d{1,2}) de (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b/);
    if (longDate && cued) {
      let d = new Date(now.getFullYear(), MONTHS[longDate[2]!]!, Number(longDate[1]));
      if (d < new Date(now.getFullYear(), now.getMonth(), now.getDate())) d = new Date(now.getFullYear() + 1, d.getMonth(), d.getDate());
      return build(d);
    }
    if (cued) {
      const wd = s.match(/\b(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/);
      if (wd) {
        const target = WEEKDAYS[wd[1]!]!;
        const delta = (target - now.getDay() + 7) % 7;
        return build(new Date(now.getFullYear(), now.getMonth(), now.getDate() + delta));
      }
      if (/\bmanana\b/.test(s)) return build(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
      if (/\bhoy\b/.test(s)) return build(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
      const inDays = s.match(/\ben (\d{1,2}) dias\b/);
      if (inDays) return build(new Date(now.getFullYear(), now.getMonth(), now.getDate() + Number(inDays[1])));
    }
  }
  return null;
}

const REPLY_CUES = [/\?/, /\bconfirm(a|ar|acion|e)\b/, /\bresponde(r|me)?\b/, /\bavisa(me)?\b/, /\bdime\b/, /\bnecesit(o|amos) (tu|que)\b/, /\bpor favor\b/, /\bquedo a la espera\b/, /\bcuando puedas\b/];
const NO_REPLY_FROM = /(no-?reply|noreply|newsletter|avisos@|notificaciones@|news@)/;

export function detectNeedsReply(input: { fromEmail: string; subject: string; body: string }): boolean {
  if (NO_REPLY_FROM.test(input.fromEmail.toLowerCase())) return false;
  const t = norm(`${input.subject}\n${input.body}`);
  if (/no es necesaria ninguna accion|no requiere (respuesta|accion)/.test(t)) return false;
  return REPLY_CUES.some((r) => r.test(t));
}

export type EmailCategory = 'trabajo' | 'finanzas' | 'viajes' | 'newsletter' | 'personal';
const CATEGORY_RULES: [EmailCategory, RegExp][] = [
  ['newsletter', /(newsletter|suscripcion|darte de baja|unsubscribe|semanal|boletin)/],
  ['viajes', /(vuelo|check-?in|reserva|hotel|localizador|billete|embarque|alojamiento)/],
  ['finanzas', /(recibo|factura|banco|poliza|seguro|pago|cargo|hipoteca|transferencia|impuesto|renovacion)/],
  ['trabajo', /(reunion|informe|contrato|cliente|propuesta|entrega|proyecto|presupuesto|equipo|deadline)/],
];
export function classifyEmail(input: { fromEmail: string; subject: string; body: string }): EmailCategory {
  const subject = norm(input.subject), all = norm(`${input.fromEmail} ${input.subject} ${input.body}`);
  // El asunto pesa más que el cuerpo: primero se evalúa solo el asunto.
  for (const [cat, re] of CATEGORY_RULES) if (re.test(subject)) return cat;
  for (const [cat, re] of CATEGORY_RULES) if (re.test(all)) return cat;
  return 'personal';
}

const fmtDeadline = (d: Date) => d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

export function summarizeEmail(input: { subject: string; body: string; fromName: string }, now: Date): string {
  const sentences = input.body.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).filter((s) => s.length > 3);
  let summary = sentences.slice(0, 2).join(' ');
  if (summary.length > 180) summary = summary.slice(0, 177).trimEnd() + '…';
  const deadline = extractDeadline(`${input.subject}. ${input.body}`, now);
  return `${summary || input.subject}${deadline ? ` Fecha límite: ${fmtDeadline(deadline)}.` : ''}`;
}

export interface SuggestedTask { title: string; dueDate: Date | null }
const TASK_CUES = /\b(necesit(o|amos)|recuerda|tienes que|hay que|por favor,? (envia|manda|revisa|confirma|firma|llama)|debes|no olvides|falta)\b/;

export function extractTasks(input: { subject: string; body: string }, now: Date): SuggestedTask[] {
  const out: SuggestedTask[] = [];
  for (const raw of input.body.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/)) {
    if (!TASK_CUES.test(norm(raw))) continue;
    const title = raw.replace(/[.!?]+$/, '').replace(/^(hola[^,]*,\s*)/i, '').trim();
    if (title.length < 8) continue;
    out.push({ title: title.length > 120 ? title.slice(0, 117) + '…' : title, dueDate: extractDeadline(raw, now) ?? extractDeadline(input.subject, now) });
  }
  if (out.length === 0) {
    const d = extractDeadline(`${input.subject}. ${input.body}`, now);
    if (d || detectNeedsReply({ fromEmail: '', ...input })) out.push({ title: `Responder: ${input.subject}`, dueDate: d });
  }
  return out.slice(0, 5);
}

/** Borrador de respuesta: solo texto para que el usuario lo revise. Nunca se envía automáticamente. */
export function draftReply(input: { fromName: string; subject: string; body: string }, me: string, now: Date): { subject: string; body: string } {
  const t = norm(`${input.subject} ${input.body}`);
  const first = input.fromName.split(' ')[0] ?? input.fromName;
  const deadline = extractDeadline(`${input.subject}. ${input.body}`, now);
  const subject = /^re:/i.test(input.subject) ? input.subject : `Re: ${input.subject}`;
  let middle: string;
  if (/confirm/.test(t)) middle = `Gracias por el envío. Lo he revisado y te confirmo [que estoy de acuerdo / los cambios que necesito]${deadline ? ` antes del ${fmtDeadline(deadline)}` : ''}.`;
  else if (/\?/.test(t) && /(comida|cena|quedamos|mesa|hora)/.test(t)) middle = 'Me va bien. [Confirma la hora o propón otra alternativa].';
  else if (/(informe|entrega|documento)/.test(t)) middle = `Recibido. Te lo hago llegar${deadline ? ` antes del ${fmtDeadline(deadline)}` : ' en cuanto lo tenga listo'}.`;
  else middle = 'Gracias por tu mensaje. [Escribe aquí tu respuesta].';
  return { subject, body: `Hola ${first},\n\n${middle}\n\nUn saludo,\n${me}` };
}

export interface EmailAnalysis { summary: string; category: EmailCategory; needsReply: boolean; deadline: Date | null }
export function analyzeEmail(e: { fromName: string; fromEmail: string; subject: string; body: string }, now: Date): EmailAnalysis {
  return {
    summary: summarizeEmail(e, now), category: classifyEmail(e), needsReply: detectNeedsReply(e),
    deadline: extractDeadline(`${e.subject}. ${e.body}`, now),
  };
}
