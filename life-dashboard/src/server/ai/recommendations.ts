import 'server-only';
import { db } from '@/lib/db';
import { getDashboardData } from '../dashboard-data';
import { getHealthData } from '../life/queries';

export interface Recommendation { id: string; title: string; detail: string; tone: 'urgent' | 'important' | 'info'; href?: string; ask?: string }

/** Recomendaciones deterministas a partir de tus propios datos (sin IA externa), de más a menos urgente. */
export async function getRecommendations(userId: string, now = new Date()): Promise<Recommendation[]> {
  const [d, health, undated] = await Promise.all([
    getDashboardData(userId, now),
    getHealthData(userId, now),
    db.task.count({ where: { userId, status: { notIn: ['done', 'waiting'] }, parentId: null, dueDate: null } }),
  ]);
  const out: Recommendation[] = [];
  if (d.nextAction.kind === 'task') out.push({ id: 'next', title: 'Tu siguiente paso', detail: d.nextAction.message, tone: 'info', ask: '¿Qué debería hacer ahora?' });
  for (const p of d.priorities.filter((p) => p.severity !== 'info').slice(0, 3)) out.push({ id: p.id, title: p.title, detail: p.detail, tone: p.severity === 'urgent' ? 'urgent' : 'important', href: p.href });
  if (undated >= 4) out.push({ id: 'undated', title: `Tienes ${undated} tareas sin fecha`, detail: 'Puedo repartirlas por tu semana según prioridad y tus huecos del calendario.', tone: 'info', ask: 'Organízame la semana' });
  const note = health.summary.notes[0];
  if (note) out.push({ id: 'health', title: 'Salud', detail: note, tone: 'info', href: '/health' });
  const f = d.finance.month;
  if (f.income > 0 && f.savingRate < 0.1) out.push({ id: 'saving', title: 'Ahorro bajo este mes', detail: `Llevas un ${Math.max(0, Math.round(f.savingRate * 100))} % de lo ingresado ahorrado. Revisa tus gastos por categoría.`, tone: 'info', ask: '¿Cuánto he gastado este mes?' });
  for (const p of d.projects.filter((p) => p.health === 'empty' && p.status === 'active').slice(0, 1)) out.push({ id: `proj-${p.id}`, title: `«${p.name}» no tiene tareas`, detail: 'Añade tareas para poder medir su avance.', tone: 'info', href: `/projects/${p.id}` });
  const rank = { urgent: 0, important: 1, info: 2 } as const;
  return out.sort((a, b) => rank[a.tone] - rank[b.tone]).slice(0, 6);
}
