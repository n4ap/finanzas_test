import { describe, expect, it } from 'vitest';
import { birthdayLabel, nextBirthday } from './family';
import { goalStreak, healthSummary, recentAverage, weekStart, weeklyWorkouts, windowChange } from './health';
import { projectStats } from './projects';
import { budgetSummary, daysUntil, groupItinerary, tripDayKeys, tripPhase } from './travel';
import { bookingSchema, familySchema, metricSchema, projectSchema, tripSchema, workoutSchema } from './validation-life';

const noon = (s: string) => new Date(`${s}T12:00:00Z`);
// Miércoles 7 oct 2026, hora local del proceso.
const NOW = new Date(2026, 9, 7, 10, 0);

describe('projectStats', () => {
  const p = { status: 'active', targetDate: noon('2026-12-01'), createdAt: new Date(2026, 8, 1) };
  it('sin tareas → empty; todo hecho → done', () => {
    expect(projectStats([], p, NOW).health).toBe('empty');
    expect(projectStats([{ status: 'done', dueDate: null }], p, NOW).health).toBe('done');
  });
  it('tarea atrasada → at_risk con motivo; fecha objetivo vencida → late', () => {
    const r = projectStats([{ status: 'next', dueDate: noon('2026-10-01') }, { status: 'done', dueDate: null }], p, NOW);
    expect(r).toMatchObject({ health: 'at_risk', overdue: 1, progress: 0.5 });
    expect(r.reason).toMatch(/atrasada/);
    expect(projectStats([{ status: 'next', dueDate: null }], { ...p, targetDate: noon('2026-10-01') }, NOW).health).toBe('late');
  });
  it('una tarea que vence hoy no está atrasada', () => {
    expect(projectStats([{ status: 'next', dueDate: noon('2026-10-07') }], p, NOW).overdue).toBe(0);
  });
  it('ritmo muy por debajo del plazo → at_risk; en pausa → paused', () => {
    const late = { status: 'active', targetDate: noon('2026-10-20'), createdAt: new Date(2026, 8, 1) };
    expect(projectStats([{ status: 'next', dueDate: null }, { status: 'next', dueDate: null }], late, NOW).health).toBe('at_risk');
    expect(projectStats([{ status: 'next', dueDate: null }], { ...p, status: 'paused' }, NOW).health).toBe('paused');
  });
});

describe('salud', () => {
  const pt = (d: string, value: number) => ({ date: noon(d), value });
  it('weekStart devuelve el lunes', () => { expect(weekStart(NOW).getDate()).toBe(5); expect(weekStart(new Date(2026, 9, 11)).getDate()).toBe(5); });
  it('media de 7 días solo con los días con dato', () => {
    const r = recentAverage([pt('2026-10-07', 6000), pt('2026-10-05', 8000), pt('2026-09-20', 100)], NOW, 7);
    expect(r).toEqual({ avg: 7000, n: 2 });
  });
  it('windowChange necesita 2 puntos', () => {
    expect(windowChange([pt('2026-10-01', 80)], NOW, 30)).toBeNull();
    expect(windowChange([pt('2026-10-07', 79.2), pt('2026-09-20', 80)], NOW, 30)).toBe(-0.8);
  });
  const w = (d: Date, planned = false) => ({ date: d, minutes: 60, calories: null, planned });
  it('weeklyWorkouts ignora planificados y marca la semana actual como parcial', () => {
    const rows = weeklyWorkouts([w(new Date(2026, 9, 6, 19)), w(new Date(2026, 9, 2, 19)), w(new Date(2026, 9, 8), true)], NOW, 3);
    expect(rows.map((r) => r.sessions)).toEqual([0, 1, 1]);
    expect(rows.at(-1)!.partial).toBe(true);
  });
  it('racha: la semana en curso incompleta no la rompe', () => {
    const row = (sessions: number, partial = false) => ({ label: '', start: '', sessions, minutes: 0, partial });
    expect(goalStreak([row(3), row(3), row(1, true)], 3)).toBe(2);
    expect(goalStreak([row(3), row(3), row(3, true)], 3)).toBe(3);
    expect(goalStreak([row(3), row(1), row(3, true)], 3)).toBe(1);
  });
  it('healthSummary genera observaciones descriptivas', () => {
    const sleep = [pt('2026-10-07', 5.5), pt('2026-10-06', 6), pt('2026-10-05', 5.8)];
    const s = healthSummary({ weight: [], steps: [], sleep, workouts: [], goals: {}, now: new Date(2026, 9, 9, 10) });
    expect(s.notes.join(' ')).toMatch(/Duermes de media 5,8 h/);
    expect(s.notes.join(' ')).toMatch(/0 de 3 entrenos/);
    expect(s.weight.last).toBeNull();
  });
});

describe('viajes', () => {
  it('fase y cuenta atrás por días naturales', () => {
    expect(tripPhase(noon('2026-10-20'), noon('2026-10-25'), NOW)).toBe('upcoming');
    expect(tripPhase(noon('2026-10-07'), noon('2026-10-09'), NOW)).toBe('ongoing');
    expect(tripPhase(noon('2026-10-01'), noon('2026-10-06'), NOW)).toBe('past');
    expect(daysUntil(noon('2026-10-07'), new Date(2026, 9, 7, 23, 59))).toBe(0);
    expect(daysUntil(noon('2026-10-20'), NOW)).toBe(13);
  });
  it('tripDayKeys incluye ambos extremos', () => { expect(tripDayKeys(noon('2026-10-27'), noon('2026-10-30'))).toEqual(['2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30']); });
  it('presupuesto: suma exacta y estados', () => {
    expect(budgetSummary(900, [190, 420, 170]).spent).toBe(780);
    expect(budgetSummary(900, [190, 420, 170]).status).toBe('warn');
    expect(budgetSummary(100, [0.1, 0.2, null]).spent).toBe(0.3);
    expect(budgetSummary(100, [150]).status).toBe('over');
    expect(budgetSummary(null, [10])).toMatchObject({ status: 'none', remaining: null });
  });
  it('itinerario: ordena por hora, sin hora al final y descarta fuera de fechas', () => {
    const it = (id: string, date: string, time: string | null) => ({ id, date: noon(date), time, title: id, notes: null });
    const plan = groupItinerary([it('c', '2026-10-27', null), it('b', '2026-10-27', '10:00'), it('a', '2026-10-27', '09:00'), it('x', '2026-12-01', null)], ['2026-10-27', '2026-10-28']);
    expect(plan[0]!.items.map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(plan[1]!.items).toEqual([]);
  });
});

describe('familia', () => {
  it('próximo cumpleaños: hoy, ya pasado este año y 29-feb', () => {
    expect(nextBirthday(noon('1990-10-07'), NOW)).toMatchObject({ daysUntil: 0, turning: 36 });
    expect(nextBirthday(noon('1990-10-06'), NOW)).toMatchObject({ daysUntil: 364, turning: 37 });
    const leap = nextBirthday(noon('2000-02-29'), NOW);
    expect(leap.date.toISOString().slice(0, 10)).toBe('2027-02-28');
    expect(nextBirthday(noon('2000-02-29'), new Date(2027, 11, 1)).date.toISOString().slice(0, 10)).toBe('2028-02-29');
  });
  it('etiquetas', () => { expect(birthdayLabel(0)).toBe('Hoy'); expect(birthdayLabel(1)).toBe('Mañana'); expect(birthdayLabel(5)).toBe('En 5 días'); });
});

describe('validación', () => {
  it('métricas con rango por tipo', () => {
    expect(metricSchema.safeParse({ kind: 'sleep', date: '2026-10-07', value: 30 }).success).toBe(false);
    expect(metricSchema.safeParse({ kind: 'weight', date: '2026-10-07', value: '79,5'.replace(',', '.') }).success).toBe(true);
    expect(metricSchema.safeParse({ kind: 'steps', date: '2026-02-30', value: 100 }).success).toBe(false);
  });
  it('viajes: orden de fechas y duración máxima', () => {
    expect(tripSchema.safeParse({ name: 'a', destination: 'b', startDate: '2026-10-10', endDate: '2026-10-09' }).success).toBe(false);
    expect(tripSchema.safeParse({ name: 'a', destination: 'b', startDate: '2026-01-01', endDate: '2026-12-31' }).success).toBe(false);
    expect(tripSchema.safeParse({ name: 'a', destination: 'b', startDate: '2026-10-10', endDate: '2026-10-12', budget: '' }).success).toBe(true);
  });
  it('reservas: fin ≥ inicio; entrenos y proyectos', () => {
    expect(bookingSchema.safeParse({ kind: 'hotel', title: 'x', startsAt: '2026-10-10T10:00:00Z', endsAt: '2026-10-09T10:00:00Z' }).success).toBe(false);
    expect(workoutSchema.safeParse({ kind: 'gym', title: 'x', date: '2026-10-07T18:00:00Z', minutes: 0 }).success).toBe(false);
    expect(workoutSchema.parse({ kind: 'gym', title: 'x', date: '2026-10-07T18:00:00Z', minutes: 45, calories: '' }).calories).toBeUndefined();
    expect(projectSchema.safeParse({ name: '  ' }).success).toBe(false);
    expect(projectSchema.safeParse({ name: 'P', color: 'red' }).success).toBe(false);
  });
  it('familia: cumpleaños no futuro', () => {
    expect(familySchema.safeParse({ name: 'A', relation: 'Madre', birthday: '2999-01-01' }).success).toBe(false);
    expect(familySchema.safeParse({ name: 'A', relation: 'Madre', birthday: '' }).success).toBe(true);
  });
});
