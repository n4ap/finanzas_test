import 'server-only';
import { db } from '@/lib/db';
import { questionByKey, weekStart } from '@/lib/coach';
import { answersSchema, decisionSchema, goalSchema, reviewSchema } from '@/lib/validation-coach';
import { fail, issue, toNoon } from '../life/core';

export const COACH_LIMITS = { goals: 150, decisions: 100 } as const;

/** Guarda (o borra, si llega vacía) las respuestas de la entrevista. */
export async function saveAnswers(userId: string, input: unknown) {
  const p = answersSchema.safeParse(input);
  if (!p.success) return fail(issue(p.error));
  let saved = 0;
  await db.$transaction(async (tx) => {
    for (const [key, raw] of Object.entries(p.data.answers)) {
      const answer = raw.trim();
      if (!answer) { await tx.coachAnswer.deleteMany({ where: { userId, key } }); continue; }
      const area = questionByKey(key)!.area;
      await tx.coachAnswer.upsert({ where: { userId_key: { userId, key } }, create: { userId, key, area, answer }, update: { answer, area } });
      saved++;
    }
  });
  return saved;
}

/** El padre debe ser del mismo usuario y de un nivel superior (visión → anual → 90 días → semana). */
async function checkParent(userId: string, level: string, parentId: string | null, selfId?: string) {
  if (!parentId) return;
  if (parentId === selfId) fail('Un objetivo no puede depender de sí mismo');
  const parent = await db.goal.findFirst({ where: { id: parentId, userId }, select: { level: true } });
  if (!parent) fail('Objetivo superior no encontrado');
  const order = ['vision', 'annual', 'quarterly', 'weekly'];
  if (order.indexOf(parent!.level) >= order.indexOf(level)) fail('El objetivo superior debe ser de un nivel más amplio');
}

const goalData = (g: ReturnType<typeof goalSchema.parse>) => ({ ...g, dueDate: g.dueDate ? toNoon(g.dueDate) : null });

export async function createGoal(userId: string, input: unknown) {
  const p = goalSchema.safeParse(input);
  if (!p.success) return fail(issue(p.error));
  if ((await db.goal.count({ where: { userId } })) >= COACH_LIMITS.goals) return fail('Has alcanzado el máximo de objetivos');
  await checkParent(userId, p.data.level, p.data.parentId);
  return (await db.goal.create({ data: { userId, ...goalData(p.data) } })).id;
}

export async function updateGoal(userId: string, id: string, input: unknown) {
  const p = goalSchema.safeParse(input);
  if (!p.success) return fail(issue(p.error));
  await checkParent(userId, p.data.level, p.data.parentId, id);
  const r = await db.goal.updateMany({ where: { id, userId }, data: goalData(p.data) });
  if (r.count === 0) fail('Objetivo no encontrado');
}

export async function setGoalProgress(userId: string, id: string, progress: unknown) {
  const n = Number(progress);
  if (!Number.isInteger(n) || n < 0 || n > 100) return fail('Progreso no válido (0-100)');
  const r = await db.goal.updateMany({ where: { id, userId }, data: { progress: n, ...(n === 100 ? { status: 'done' } : {}) } });
  if (r.count === 0) fail('Objetivo no encontrado');
}

/** Borra el objetivo; sus objetivos dependientes se conservan sin padre. */
export async function deleteGoal(userId: string, id: string) {
  const r = await db.goal.deleteMany({ where: { id, userId } });
  if (r.count === 0) fail('Objetivo no encontrado');
}

/** Convierte la próxima acción de un objetivo en una tarea (con etiqueta «coach»). */
export async function goalActionToTask(userId: string, id: string, dueKey?: string) {
  const g = await db.goal.findFirst({ where: { id, userId } });
  if (!g) return fail('Objetivo no encontrado');
  if (!g.nextAction?.trim()) return fail('Este objetivo no tiene próxima acción');
  if (dueKey && !/^\d{4}-\d{2}-\d{2}$/.test(dueKey)) return fail('Fecha no válida');
  const t = await db.task.create({ data: { userId, title: g.nextAction.trim().slice(0, 200), description: `Próxima acción del objetivo «${g.title}»`, priority: g.level === 'weekly' || g.level === 'quarterly' ? 1 : 2, status: 'next', dueDate: dueKey ? toNoon(dueKey) : null, tags: ['coach'] } });
  return t.id;
}

/** Guarda la revisión del periodo (una por día, semana o mes; se puede editar). El periodo semanal se normaliza al lunes. */
export async function saveReview(userId: string, input: unknown) {
  const p = reviewSchema.safeParse(input);
  if (!p.success) return fail(issue(p.error));
  const r = p.data;
  const period = r.kind === 'weekly' ? weekStart(r.period) : r.period;
  const answers = Object.fromEntries(Object.entries(r.answers).filter(([, v]) => v && v.trim()).map(([k, v]) => [k, v!.trim()]));
  const extra = r.kind === 'daily' ? { energy: r.energy ?? null, mood: r.mood ?? null, stress: r.stress ?? null } : r.kind === 'weekly' ? { scores: r.scores } : {};
  const row = await db.review.upsert({
    where: { userId_kind_period: { userId, kind: r.kind, period } },
    create: { userId, kind: r.kind, period, answers, ...extra },
    update: { answers, ...extra },
  });
  return row.id;
}

/** Revisión diaria: convierte «la prioridad de mañana» en una tarea para mañana. */
export async function priorityToTask(userId: string, title: unknown, dueKey: unknown) {
  if (typeof title !== 'string' || !title.trim() || title.length > 200) return fail('Escribe la prioridad');
  if (typeof dueKey !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dueKey)) return fail('Fecha no válida');
  return (await db.task.create({ data: { userId, title: title.trim(), priority: 1, status: 'next', dueDate: toNoon(dueKey), tags: ['coach'] } })).id;
}

export async function createDecision(userId: string, input: unknown) {
  const p = decisionSchema.safeParse(input);
  if (!p.success) return fail(issue(p.error));
  if ((await db.decision.count({ where: { userId } })) >= COACH_LIMITS.decisions) return fail('Has alcanzado el máximo de decisiones');
  return (await db.decision.create({ data: { userId, ...p.data } })).id;
}

export async function updateDecision(userId: string, id: string, input: unknown) {
  const p = decisionSchema.safeParse(input);
  if (!p.success) return fail(issue(p.error));
  const r = await db.decision.updateMany({ where: { id, userId }, data: p.data });
  if (r.count === 0) fail('Decisión no encontrada');
}

export async function deleteDecision(userId: string, id: string) {
  const r = await db.decision.deleteMany({ where: { id, userId } });
  if (r.count === 0) fail('Decisión no encontrada');
}
