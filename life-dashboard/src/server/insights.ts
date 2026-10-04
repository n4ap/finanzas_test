/**
 * Motor de "inteligencia" del dashboard: funciones puras y deterministas (sin IA externa),
 * por lo que son testeables y no envían datos privados a terceros.
 */
export interface TaskLite { id: string; title: string; priority: number; status: string; dueDate: Date | null; estimateMinutes: number | null; projectName?: string | null }
export interface EventLite { id: string; title: string; startsAt: Date; endsAt: Date; location?: string | null; important?: boolean }
export interface EmailLite { id: string; subject: string; fromName: string; needsReply: boolean; replied: boolean; deadline: Date | null; important: boolean }
export interface PaymentLite { id: string; description: string; amount: number; date: Date }
export interface SpendLite { category: string; amount: number; date: Date }

export type Severity = 'urgent' | 'important' | 'info';
export interface PriorityItem { id: string; kind: 'task' | 'email' | 'payment' | 'event' | 'conflict' | 'finance'; severity: Severity; title: string; detail: string; href: string }

const DAY = 86_400_000;
const sod = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const daysUntil = (d: Date, now: Date) => Math.round((sod(d) - sod(now)) / DAY);

export const isOpen = (t: TaskLite) => t.status !== 'done';
export const isOverdue = (t: TaskLite, now: Date) => isOpen(t) && t.dueDate !== null && sod(t.dueDate) < sod(now);

export function detectConflicts(events: EventLite[]): [EventLite, EventLite][] {
  const sorted = [...events].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const out: [EventLite, EventLite][] = [];
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i]!, b = sorted[j]!;
      if (b.startsAt >= a.endsAt) break;
      out.push([a, b]);
    }
  }
  return out;
}

/** Gasto del mes en curso por categoría que supera 1.5x la media de los (hasta 3) meses anteriores con datos, exigiendo ≥2 (mín. 50 € de diferencia). */
export function unusualSpending(spend: SpendLite[], now: Date): { category: string; current: number; average: number }[] {
  const monthKey = (d: Date) => d.getFullYear() * 12 + d.getMonth();
  const cur = monthKey(now);
  const byCat = new Map<string, { current: number; prev: Map<number, number> }>();
  for (const s of spend) {
    if (s.amount >= 0) continue;
    const m = monthKey(s.date);
    if (m > cur || m < cur - 3) continue;
    const e = byCat.get(s.category) ?? { current: 0, prev: new Map() };
    if (m === cur) e.current += -s.amount;
    else e.prev.set(m, (e.prev.get(m) ?? 0) + -s.amount);
    byCat.set(s.category, e);
  }
  const res: { category: string; current: number; average: number }[] = [];
  for (const [category, e] of byCat) {
    if (e.prev.size < 2) continue; // sin histórico suficiente no hay referencia fiable
    const average = [...e.prev.values()].reduce((a, b) => a + b, 0) / e.prev.size;
    if (average > 0 && e.current > average * 1.5 && e.current - average >= 50) res.push({ category, current: e.current, average });
  }
  return res.sort((a, b) => b.current - b.average - (a.current - a.average));
}

export interface PriorityInput { now: Date; tasks: TaskLite[]; emails: EmailLite[]; events: EventLite[]; upcomingPayments: PaymentLite[]; spend: SpendLite[] }

const rank: Record<Severity, number> = { urgent: 0, important: 1, info: 2 };

export function buildPriorities({ now, tasks, emails, events, upcomingPayments, spend }: PriorityInput): PriorityItem[] {
  const items: PriorityItem[] = [];

  for (const t of tasks.filter((t) => isOverdue(t, now))) {
    const late = -daysUntil(t.dueDate!, now);
    items.push({ id: `task-${t.id}`, kind: 'task', severity: 'urgent', title: t.title, detail: `Atrasada ${plural(late, 'día', 'días')}`, href: '/tasks' });
  }
  for (const t of tasks.filter((t) => isOpen(t) && t.dueDate && daysUntil(t.dueDate, now) >= 0 && daysUntil(t.dueDate, now) <= 1 && t.priority === 1)) {
    items.push({ id: `task-${t.id}`, kind: 'task', severity: 'important', title: t.title, detail: daysUntil(t.dueDate!, now) === 0 ? 'Vence hoy' : 'Vence mañana', href: '/tasks' });
  }
  for (const e of emails.filter((e) => e.needsReply && !e.replied)) {
    const d = e.deadline ? daysUntil(e.deadline, now) : null;
    const sev: Severity = d !== null && d <= 2 ? 'urgent' : e.important ? 'important' : 'info';
    items.push({ id: `email-${e.id}`, kind: 'email', severity: sev, title: e.subject, detail: d !== null ? `${e.fromName} · responder ${d <= 0 ? 'hoy' : 'en ' + plural(d, 'día', 'días')}` : `${e.fromName} · requiere respuesta`, href: '/email' });
  }
  for (const p of upcomingPayments) {
    const d = daysUntil(p.date, now);
    if (d < 0 || d > 7) continue;
    items.push({ id: `pay-${p.id}`, kind: 'payment', severity: d <= 2 ? 'urgent' : 'important', title: p.description, detail: `${Math.abs(p.amount).toFixed(0)} € · ${d === 0 ? 'hoy' : 'en ' + plural(d, 'día', 'días')}`, href: '/finance' });
  }
  for (const [a, b] of detectConflicts(events.filter((e) => e.endsAt > now))) {
    items.push({ id: `conf-${a.id}-${b.id}`, kind: 'conflict', severity: 'urgent', title: `Conflicto: ${a.title} / ${b.title}`, detail: 'Eventos solapados en el calendario', href: '/calendar' });
  }
  for (const u of unusualSpending(spend, now)) {
    items.push({ id: `spend-${u.category}`, kind: 'finance', severity: 'important', title: `Gasto inusual en ${u.category}`, detail: `${u.current.toFixed(0)} € este mes (media ${u.average.toFixed(0)} €)`, href: '/finance' });
  }
  for (const e of events.filter((e) => e.important && e.startsAt > now && e.startsAt.getTime() - now.getTime() < 2 * DAY)) {
    items.push({ id: `evt-${e.id}`, kind: 'event', severity: 'important', title: e.title, detail: 'Evento importante próximo', href: '/calendar' });
  }
  return items.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

export interface NextAction { kind: 'task' | 'event' | 'rest'; title: string; message: string; taskId?: string }

/** Recomienda la siguiente acción según hueco libre hasta el próximo evento y la prioridad/urgencia de las tareas. */
export function recommendNextAction({ now, tasks, events }: { now: Date; tasks: TaskLite[]; events: EventLite[] }): NextAction {
  const current = events.find((e) => e.startsAt <= now && e.endsAt > now);
  if (current) {
    const mins = Math.ceil((current.endsAt.getTime() - now.getTime()) / 60_000);
    return { kind: 'event', title: current.title, message: `Estás en «${current.title}». Termina en ${mins} min.` };
  }
  const next = events.filter((e) => e.startsAt > now).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0];
  const free = next ? Math.floor((next.startsAt.getTime() - now.getTime()) / 60_000) : 240;

  const score = (t: TaskLite) => {
    let s = (4 - t.priority) * 10;
    if (isOverdue(t, now)) s += 40;
    else if (t.dueDate) s += Math.max(0, 14 - daysUntil(t.dueDate, now));
    if (t.status === 'in_progress') s += 8;
    return s;
  };
  const candidates = tasks.filter((t) => isOpen(t) && t.status !== 'waiting' && t.status !== 'inbox');
  const fits = candidates.filter((t) => (t.estimateMinutes ?? 30) <= free).sort((a, b) => score(b) - score(a));
  const best = fits[0] ?? candidates.sort((a, b) => score(b) - score(a))[0];
  const freeText = free >= 180 ? `Tienes un bloque largo libre antes de «${next?.title}»` : `Tienes ${free} minutos libres antes de «${next?.title}»`;
  const gap = next ? `${freeText}. ` : 'No tienes más eventos próximos. ';
  if (!best) return { kind: 'rest', title: 'Sin tareas pendientes', message: `${gap}No hay tareas accionables: buen momento para descansar o planificar.` };
  const why = isOverdue(best, now) ? 'está atrasada' : best.priority === 1 ? 'es de máxima prioridad' : 'es la más prioritaria';
  const fitNote = fits.includes(best) ? '' : ' (es más larga que tu hueco: avanza lo que puedas)';
  return { kind: 'task', title: best.title, taskId: best.id, message: `${gap}Te recomiendo «${best.title}» porque ${why}${fitNote}.` };
}
