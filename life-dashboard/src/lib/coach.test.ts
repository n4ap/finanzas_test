import { describe, expect, it } from 'vitest';
import {
  ALL_QUESTIONS, INTERVIEW, coachInsights, dailyFocus, interviewProgress, isoWeekday, lifeMap, monthlyComparison, prevMonth, scoreTrends, weekStart,
  type GoalLite, type InsightInput,
} from './coach';

const goal = (o: Partial<GoalLite> = {}): GoalLite => ({ id: Math.random().toString(36).slice(2), level: 'quarterly', area: 'salud', title: 'Correr 10 km', metric: 'km', nextAction: 'Salir a correr el martes', dueDate: null, progress: 0, status: 'active', ...o });
const base = (o: Partial<InsightInput> = {}): InsightInput => ({
  todayKey: '2026-10-08', goals: [], lastWeekly: '2026-10-05', recentDaily: [], trends: null,
  health: { sleepAvg: 7.5, workoutsWeek: 2, workoutTarget: 3, daysSinceWorkout: 1 },
  finance: { income: 2000, expenses: 1500, savingRate: 0.25, overBudget: [] }, overdueTasks: 0,
  interview: { answered: 40, complete: true }, ...o,
});
const ids = (i: InsightInput) => coachInsights(i).map((x) => x.id);

describe('entrevista', () => {
  it('8 bloques de 5 a 8 preguntas con claves únicas', () => {
    expect(INTERVIEW).toHaveLength(8);
    for (const b of INTERVIEW) { expect(b.questions.length).toBeGreaterThanOrEqual(5); expect(b.questions.length).toBeLessThanOrEqual(8); }
    expect(new Set(ALL_QUESTIONS.map((q) => q.key)).size).toBe(ALL_QUESTIONS.length);
  });
  it('progreso: un bloque está hecho con la mitad de respuestas; el siguiente es el primero sin hacer', () => {
    const p0 = interviewProgress([]);
    expect(p0).toMatchObject({ answered: 0, nextBlock: 0, complete: false });
    const first = INTERVIEW[0]!.questions.slice(0, 3).map((q) => q.key);
    expect(interviewProgress(first).nextBlock).toBe(1);
    expect(interviewProgress(ALL_QUESTIONS.map((q) => q.key)).complete).toBe(true);
  });
  it('mapa de vida agrupa por área y omite vacíos', () => {
    const m = lifeMap([{ key: 'h_sueno', answer: '6 h' }, { key: 'f_ahorro', answer: '200 €' }, { key: 'v_dia', answer: '  ' }]);
    expect(m.map((a) => a.id)).toEqual(['salud', 'finanzas']);
    expect(m[0]!.items[0]).toMatchObject({ key: 'h_sueno', answer: '6 h' });
  });
});

describe('periodos', () => {
  it('lunes de la semana y día de la semana ISO', () => {
    expect(weekStart('2026-10-08')).toBe('2026-10-05');
    expect(weekStart('2026-10-05')).toBe('2026-10-05');
    expect(weekStart('2026-10-11')).toBe('2026-10-05');
    expect(isoWeekday('2026-10-11')).toBe(7);
    expect(weekStart('2027-01-01')).toBe('2026-12-28');
  });
  it('mes anterior cruza el año', () => { expect(prevMonth('2026-01')).toBe('2025-12'); expect(prevMonth('2026-10')).toBe('2026-09'); });
});

describe('tendencias', () => {
  const weeks = [
    { period: '2026-09-14', scores: { fisica: 7, relaciones: 8, trabajo: 6 } },
    { period: '2026-09-21', scores: { fisica: 6, relaciones: 7, trabajo: 7 } },
    { period: '2026-09-28', scores: { fisica: 5, relaciones: 7, trabajo: 8 } },
    { period: '2026-10-05', scores: { fisica: 4, relaciones: 6, trabajo: 9 } },
  ];
  it('detecta descensos e incrementos de tres semanas y el mejor/peor área', () => {
    const t = scoreTrends(weeks);
    const f = t.areas.find((a) => a.id === 'fisica')!;
    expect(f).toMatchObject({ last: 4, prev: 5, delta: -1, declining: true });
    expect(t.areas.find((a) => a.id === 'trabajo')!.improving).toBe(true);
    expect(t.areas.find((a) => a.id === 'relaciones')!.declining).toBe(false); // 7 → 7 → 6 no es descenso continuo
    expect(t.best!.id).toBe('trabajo');
    expect(t.worst!.id).toBe('fisica');
  });
  it('comparación mensual: media por área frente al mes anterior', () => {
    const c = monthlyComparison(weeks, '2026-09');
    expect(c.weeks).toBe(3);
    expect(c.areas.find((a) => a.id === 'fisica')!.current).toBe(6);
    const oct = monthlyComparison(weeks, '2026-10');
    expect(oct.areas.find((a) => a.id === 'fisica')).toMatchObject({ current: 4, previous: 6, delta: -2 });
  });
});

describe('alertas proactivas', () => {
  it('sin entrevista: sugiere empezarla', () => expect(ids(base({ interview: { answered: 0, complete: false } }))).toContain('interview-start'));
  it('más de 3 objetivos de 90 días = foco diluido', () => {
    expect(ids(base({ goals: [goal(), goal(), goal(), goal()] }))).toContain('too-many-goals');
    expect(ids(base({ goals: [goal(), goal(), goal()] }))).not.toContain('too-many-goals');
  });
  it('sin objetivos de 90 días tras la entrevista', () => expect(ids(base())).toContain('no-quarterly'));
  it('objetivos sin próxima acción, sin métrica y vencidos', () => {
    const r = ids(base({ goals: [goal({ nextAction: null }), goal({ metric: null }), goal({ dueDate: '2026-10-01', progress: 40 })] }));
    expect(r).toEqual(expect.arrayContaining(['no-next-action', 'vague-goals', 'overdue-goals']));
  });
  it('contradicción: objetivo de salud sin entrenar', () => {
    const r = coachInsights(base({ goals: [goal()], health: { sleepAvg: 7.5, workoutsWeek: 0, workoutTarget: 3, daysSinceWorkout: 12 } }));
    const c = r.find((x) => x.id === 'health-contradiction')!;
    expect(c.detail).toMatch(/12 días sin entrenar/);
  });
  it('sueño corto es alerta y va primero (salud antes que el resto)', () => {
    const r = coachInsights(base({ goals: [goal({ area: 'finanzas', title: 'Ahorrar 3000 €' })], health: { sleepAvg: 6, workoutsWeek: 2, workoutTarget: 3, daysSinceWorkout: 1 }, finance: { income: 2000, expenses: 2100, savingRate: -0.05, overBudget: ['ocio'] } }));
    expect(r[0]!.id).toBe('sleep');
    expect(r.map((x) => x.id)).toEqual(expect.arrayContaining(['overspend', 'over-budget', 'money-contradiction']));
  });
  it('ánimo bajo tres días: recomienda apoyo profesional sin diagnosticar', () => {
    const d = (period: string) => ({ period, mood: 3, energy: 4, stress: 6 });
    const x = coachInsights(base({ recentDaily: [d('2026-10-08'), d('2026-10-07'), d('2026-10-06')] })).find((i) => i.id === 'low-mood')!;
    expect(x.level).toBe('alert');
    expect(x.detail).toMatch(/médico o un psicólogo/);
  });
  it('procrastinación, revisión semanal pendiente y exceso de trabajo', () => {
    const t = scoreTrends([{ period: '2026-10-05', scores: { trabajo: 9, relaciones: 3 } }]);
    const r = ids(base({ goals: [goal()], overdueTasks: 7, lastWeekly: '2026-09-14', trends: t }));
    expect(r).toEqual(expect.arrayContaining(['procrastination', 'weekly-review', 'overwork']));
  });
  it('todo en orden: sin avisos', () => {
    expect(coachInsights(base({ goals: [goal(), goal({ area: 'finanzas', title: 'Ahorro' })] }))).toEqual([]);
  });
});

describe('foco del día', () => {
  it('1-3 importantes (prioridad alta primero), lo pospuesto y la acción de ahora', () => {
    const f = dailyFocus('2026-10-08', [
      { id: 'a', title: 'Llamar al banco', priority: 2, dueKey: '2026-10-08', status: 'next' },
      { id: 'b', title: 'Informe', priority: 1, dueKey: '2026-10-03', status: 'next' },
      { id: 'c', title: 'Hecha', priority: 1, dueKey: '2026-10-08', status: 'done' },
      { id: 'd', title: 'Futuro', priority: 1, dueKey: '2026-10-20', status: 'next' },
    ], [goal({ level: 'weekly', nextAction: 'Entrenar fuerza 3 días' })]);
    expect(f.important.map((x) => x.title)).toEqual(['Informe', 'Entrenar fuerza 3 días', 'Llamar al banco']);
    expect(f.postponed).toEqual([{ id: 'b', title: 'Informe', days: 5 }]);
    expect(f.now).toBe('Informe');
  });
});
