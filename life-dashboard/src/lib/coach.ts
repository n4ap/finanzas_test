/** Coach personal: catálogo (entrevista, áreas, niveles de objetivo) y lógica pura (periodos, tendencias, alertas). Sin BD. */

// ───────────── Áreas ─────────────

/** Áreas del mapa de vida (perfil). */
export const PROFILE_AREAS = [
  { id: 'personal', label: 'Personal', emoji: '🧭' },
  { id: 'salud', label: 'Salud física', emoji: '🏋️' },
  { id: 'emocional', label: 'Salud emocional', emoji: '🧠' },
  { id: 'finanzas', label: 'Finanzas', emoji: '💰' },
  { id: 'productividad', label: 'Productividad', emoji: '⏱️' },
  { id: 'profesion', label: 'Profesión', emoji: '💼' },
  { id: 'relaciones', label: 'Relaciones', emoji: '❤️' },
  { id: 'ocio', label: 'Ocio y experiencias', emoji: '✈️' },
  { id: 'aprendizaje', label: 'Aprendizaje', emoji: '📚' },
  { id: 'vision', label: 'Visión a 3-5 años', emoji: '🔭' },
] as const;
export type ProfileArea = (typeof PROFILE_AREAS)[number]['id'];

/** Áreas de objetivos, en el orden de prioridad por defecto: salud → relaciones → seguridad financiera → trabajo → crecimiento → ocio. */
export const GOAL_AREAS = [
  { id: 'salud', label: 'Salud', emoji: '🏋️' },
  { id: 'relaciones', label: 'Relaciones', emoji: '❤️' },
  { id: 'finanzas', label: 'Seguridad financiera', emoji: '💰' },
  { id: 'trabajo', label: 'Trabajo y proyectos', emoji: '💼' },
  { id: 'crecimiento', label: 'Crecimiento', emoji: '📚' },
  { id: 'ocio', label: 'Ocio', emoji: '😊' },
] as const;
export type GoalArea = (typeof GOAL_AREAS)[number]['id'];
export const goalAreaRank = (a: string) => { const i = GOAL_AREAS.findIndex((x) => x.id === a); return i < 0 ? GOAL_AREAS.length : i; };

export const GOAL_LEVELS = [
  { id: 'vision', label: 'Visión', hint: '¿Qué quieres conseguir en tu vida?' },
  { id: 'annual', label: 'Anual', hint: '¿Qué quieres conseguir en los próximos 12 meses?' },
  { id: 'quarterly', label: '90 días', hint: '¿Qué debes conseguir en los próximos 90 días?' },
  { id: 'weekly', label: 'Esta semana', hint: '¿Qué tienes que hacer esta semana?' },
] as const;
export type GoalLevel = (typeof GOAL_LEVELS)[number]['id'];
export const MAX_FOCUS_GOALS = 3;

/** Puntuación semanal 0-10 (para ver tendencias, no para juzgar). */
export const SCORE_AREAS = [
  { id: 'fisica', label: 'Salud física', emoji: '🏋️' },
  { id: 'mental', label: 'Bienestar mental', emoji: '🧠' },
  { id: 'finanzas', label: 'Finanzas', emoji: '💰' },
  { id: 'trabajo', label: 'Trabajo/proyectos', emoji: '💼' },
  { id: 'aprendizaje', label: 'Aprendizaje', emoji: '📚' },
  { id: 'relaciones', label: 'Relaciones', emoji: '❤️' },
  { id: 'productividad', label: 'Productividad', emoji: '⏱️' },
  { id: 'objetivos', label: 'Objetivos', emoji: '🎯' },
  { id: 'descanso', label: 'Descanso', emoji: '😴' },
  { id: 'disfrute', label: 'Disfrute', emoji: '😊' },
] as const;
export type ScoreArea = (typeof SCORE_AREAS)[number]['id'];
export type Scores = Partial<Record<ScoreArea, number>>;

// ───────────── Entrevista inicial (bloques de 5-8 preguntas) ─────────────

export interface Question { key: string; area: ProfileArea; text: string; hint?: string }
export interface InterviewBlock { id: string; title: string; questions: Question[] }

export const INTERVIEW: InterviewBlock[] = [
  { id: 'situacion', title: 'Tu situación actual', questions: [
    { key: 's_situacion', area: 'personal', text: 'Cuéntame tu situación actual en 2-3 frases: edad, con quién vives y a qué te dedicas.' },
    { key: 's_dia', area: 'productividad', text: '¿Cómo es un día normal entre semana, de la mañana a la noche?' },
    { key: 's_satisfaccion', area: 'personal', text: 'Del 0 al 10, ¿cómo de satisfecho estás hoy con tu vida? ¿Por qué ese número y no uno más alto?' },
    { key: 's_mantener', area: 'personal', text: '¿Qué está funcionando bien y quieres mantener?' },
    { key: 's_energia', area: 'emocional', text: '¿Qué te quita más energía o te genera más estrés últimamente?' },
    { key: 's_tiempo', area: 'productividad', text: '¿Cuánto tiempo libre real tienes a la semana y en qué se te va?' },
  ] },
  { id: 'cambio', title: 'Lo que más quieres cambiar', questions: [
    { key: 'c_una', area: 'personal', text: 'Si solo pudieras cambiar UNA cosa de tu vida en los próximos 3 meses, ¿cuál sería?' },
    { key: 'c_porque', area: 'personal', text: '¿Por qué es importante para ti? ¿Qué pasa si no cambia?', hint: 'Tu motivación real.' },
    { key: 'c_intentos', area: 'personal', text: '¿Lo has intentado antes? ¿Qué funcionó y qué no?' },
    { key: 'c_habitos', area: 'productividad', text: '¿Qué hábitos tienes que sabes que te perjudican?' },
    { key: 'c_fortalezas', area: 'personal', text: '¿Cuáles son tus 3 mayores fortalezas?' },
    { key: 'c_miedos', area: 'emocional', text: '¿Qué miedos o dudas te frenan?' },
    { key: 'c_valores', area: 'personal', text: '¿Qué 3 valores son innegociables para ti?', hint: 'Por ejemplo: familia, salud, libertad, honestidad, seguridad.' },
  ] },
  { id: 'objetivos', title: 'Tus objetivos principales', questions: [
    { key: 'o_salud', area: 'salud', text: 'En 12 meses, ¿qué te gustaría haber conseguido en salud y forma física?' },
    { key: 'o_finanzas', area: 'finanzas', text: '¿Y en dinero (ahorro, deudas, inversión, ingresos)?' },
    { key: 'o_trabajo', area: 'profesion', text: '¿Y en tu trabajo o proyectos?' },
    { key: 'o_relaciones', area: 'relaciones', text: '¿Y en tus relaciones (familia, pareja, amigos)?' },
    { key: 'o_personal', area: 'aprendizaje', text: '¿Y en crecimiento personal o aprendizaje?' },
    { key: 'o_prioridad', area: 'personal', text: 'De todo eso, ¿qué es lo MÁS importante y por qué?' },
  ] },
  { id: 'salud', title: 'Salud y hábitos', questions: [
    { key: 'h_entreno', area: 'salud', text: '¿Qué ejercicio haces y cuántas veces por semana?', hint: 'Fuerza, cardio, pádel, movilidad…' },
    { key: 'h_sueno', area: 'salud', text: '¿Cuántas horas duermes de media y cómo descansas?' },
    { key: 'h_alimentacion', area: 'salud', text: '¿Cómo comes en un día normal? ¿Qué te cuesta más?' },
    { key: 'h_energia', area: 'salud', text: 'Del 1 al 10, ¿cómo es tu energía durante el día? ¿Cuándo baja?' },
    { key: 'h_limitaciones', area: 'salud', text: '¿Tienes lesiones, dolores o limitaciones físicas?', hint: 'Solo para adaptar los consejos: no se diagnostica nada.' },
    { key: 'h_cuerpo', area: 'salud', text: '¿Tienes algún objetivo de peso o composición corporal? (opcional)' },
    { key: 'h_animo', area: 'emocional', text: '¿Cómo está tu ánimo últimamente? ¿Estrés, ansiedad, motivación?' },
  ] },
  { id: 'finanzas', title: 'Situación financiera', questions: [
    { key: 'f_ingresos', area: 'finanzas', text: '¿Cuáles son tus ingresos netos mensuales aproximados? ¿Son estables?' },
    { key: 'f_gastos', area: 'finanzas', text: '¿Cuánto gastas al mes más o menos y en qué se va la mayor parte?' },
    { key: 'f_ahorro', area: 'finanzas', text: '¿Ahorras cada mes? ¿Cuánto?' },
    { key: 'f_emergencia', area: 'finanzas', text: '¿Tienes fondo de emergencia? ¿Para cuántos meses de gastos?' },
    { key: 'f_deudas', area: 'finanzas', text: '¿Tienes deudas (hipoteca, préstamos, tarjetas)? Importe e interés aproximados.' },
    { key: 'f_inversion', area: 'finanzas', text: '¿Inviertes? ¿En qué y con qué tolerancia al riesgo (baja, media, alta)?' },
    { key: 'f_objetivo', area: 'finanzas', text: '¿Qué objetivo financiero tienes? (casa, colchón, independencia, jubilación…)' },
    { key: 'f_extra', area: 'finanzas', text: '¿Tienes o te gustaría tener ingresos extra o proyectos para aumentarlos?' },
  ] },
  { id: 'trabajo', title: 'Trabajo y proyectos', questions: [
    { key: 't_trabajo', area: 'profesion', text: '¿A qué te dedicas y cuánto te gusta del 0 al 10?' },
    { key: 't_horas', area: 'profesion', text: '¿Cuántas horas trabajas a la semana? ¿Te llevas trabajo a casa?' },
    { key: 't_habilidades', area: 'profesion', text: '¿Qué habilidades tuyas se valoran más? ¿Cuáles te faltan?' },
    { key: 't_futuro', area: 'profesion', text: '¿Dónde quieres estar profesionalmente dentro de 2-3 años?' },
    { key: 't_formacion', area: 'aprendizaje', text: '¿Qué formación, cursos, idiomas o libros te interesan?' },
    { key: 't_proyectos', area: 'profesion', text: '¿Tienes proyectos personales en marcha o en mente?' },
  ] },
  { id: 'relaciones', title: 'Relaciones y vida personal', questions: [
    { key: 'r_familia', area: 'relaciones', text: '¿Cómo está la relación con tu familia? ¿Le dedicas el tiempo que quieres?' },
    { key: 'r_pareja', area: 'relaciones', text: '¿Tienes pareja? ¿Cómo está la relación? (opcional)' },
    { key: 'r_amigos', area: 'relaciones', text: '¿Cada cuánto ves a tus amigos? ¿Te gustaría que fuese más?' },
    { key: 'r_calidad', area: 'relaciones', text: '¿Con quién quieres pasar más tiempo de calidad?' },
    { key: 'r_aficiones', area: 'ocio', text: '¿Qué aficiones tienes y cuánto tiempo les dedicas?' },
    { key: 'r_experiencias', area: 'ocio', text: '¿Qué viajes o experiencias quieres vivir?' },
  ] },
  { id: 'vision', title: 'Tu vida dentro de 3-5 años', questions: [
    { key: 'v_dia', area: 'vision', text: 'Imagina un día normal dentro de 5 años si todo va bien: ¿cómo es?' },
    { key: 'v_logros', area: 'vision', text: '¿Qué tienes que haber conseguido para sentir que han sido buenos años?' },
    { key: 'v_dejar', area: 'vision', text: '¿Qué quieres haber dejado atrás?' },
    { key: 'v_persona', area: 'vision', text: '¿Qué tipo de persona quieres ser? ¿Cómo te describirían los demás?' },
    { key: 'v_sacrificio', area: 'vision', text: '¿Qué NO estás dispuesto a sacrificar para conseguirlo?' },
  ] },
];
export const ALL_QUESTIONS: Question[] = INTERVIEW.flatMap((b) => b.questions);
export const questionByKey = (k: string) => ALL_QUESTIONS.find((q) => q.key === k);

/** Un bloque cuenta como hecho con al menos la mitad de sus preguntas respondidas (todas son opcionales). */
export function interviewProgress(answered: Iterable<string>) {
  const set = new Set(answered);
  const blocks = INTERVIEW.map((b) => {
    const n = b.questions.filter((q) => set.has(q.key)).length;
    return { id: b.id, title: b.title, answered: n, total: b.questions.length, done: n * 2 >= b.questions.length };
  });
  const next = blocks.findIndex((b) => !b.done);
  return { blocks, answered: ALL_QUESTIONS.filter((q) => set.has(q.key)).length, total: ALL_QUESTIONS.length, nextBlock: next, complete: next === -1 };
}

/** Mapa personal de vida: respuestas agrupadas por área, en el orden del perfil. */
export function lifeMap(answers: { key: string; answer: string }[]) {
  const byKey = new Map(answers.map((a) => [a.key, a.answer]));
  return PROFILE_AREAS.map((area) => ({
    ...area,
    items: ALL_QUESTIONS.filter((q) => q.area === area.id && byKey.get(q.key)?.trim()).map((q) => ({ key: q.key, question: q.text, answer: byKey.get(q.key)!.trim() })),
  })).filter((a) => a.items.length > 0);
}

// ───────────── Revisiones ─────────────

export const DAILY_QUESTIONS = [
  { key: 'logros', text: '¿Qué has conseguido hoy?' },
  { key: 'mal', text: '¿Qué ha salido mal?' },
  { key: 'habitos', text: '¿Has cumplido tus hábitos importantes?' },
  { key: 'aprendido', text: '¿Qué has aprendido?' },
  { key: 'posponiendo', text: '¿Qué estás posponiendo? ¿Puedes eliminarlo o delegarlo?' },
  { key: 'manana', text: '¿Cuál es la prioridad de mañana?' },
] as const;

export const WEEKLY_QUESTIONS = [
  { key: 'funciona', text: 'Lo que ha funcionado' },
  { key: 'no_funciona', text: 'Lo que no ha funcionado' },
  { key: 'cambiar', text: 'Lo que debes cambiar' },
  { key: 'prioridad', text: 'Tu prioridad de la próxima semana' },
] as const;

export const MONTHLY_QUESTIONS = [
  { key: 'balance', text: '¿Cómo resumirías este mes en una frase?' },
  { key: 'patrones', text: '¿Qué patrones ves que se repiten (buenos y malos)?' },
  { key: 'ajuste', text: '¿Qué vas a ajustar el mes que viene?' },
] as const;

export type ReviewKind = 'daily' | 'weekly' | 'monthly';

const pad = (n: number) => String(n).padStart(2, '0');
const keyToUtc = (k: string) => new Date(`${k}T12:00:00Z`);
const utcToKey = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
export const addDays = (k: string, n: number) => { const d = keyToUtc(k); d.setUTCDate(d.getUTCDate() + n); return utcToKey(d); };
/** 1 = lunes … 7 = domingo. */
export const isoWeekday = (k: string) => ((keyToUtc(k).getUTCDay() + 6) % 7) + 1;
export const weekStart = (dayKey: string) => addDays(dayKey, 1 - isoWeekday(dayKey));
export const monthOf = (dayKey: string) => dayKey.slice(0, 7);
export const prevMonth = (m: string) => { const [y, mo] = m.split('-').map(Number) as [number, number]; return mo === 1 ? `${y - 1}-12` : `${y}-${pad(mo - 1)}`; };
export const daysBetween = (a: string, b: string) => Math.round((keyToUtc(b).getTime() - keyToUtc(a).getTime()) / 86_400_000);
export function periodFor(kind: ReviewKind, dayKey: string) { return kind === 'daily' ? dayKey : kind === 'weekly' ? weekStart(dayKey) : monthOf(dayKey); }

// ───────────── Tendencias de la puntuación semanal ─────────────

export interface WeeklyScores { period: string; scores: Scores }
const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);

export function scoreTrends(weeks: WeeklyScores[]) {
  const sorted = [...weeks].sort((a, b) => a.period.localeCompare(b.period));
  const areas = SCORE_AREAS.map((a) => {
    const series = sorted.map((w) => ({ period: w.period, value: w.scores[a.id] ?? null }));
    const vals = series.map((s) => s.value).filter((v): v is number => v !== null);
    const last = vals.at(-1) ?? null;
    const prev = vals.at(-2) ?? null;
    const l3 = vals.slice(-3);
    return {
      ...a, series, last, prev, delta: last !== null && prev !== null ? last - prev : null, avg4: avg(vals.slice(-4)),
      declining: l3.length === 3 && l3[0]! > l3[1]! && l3[1]! > l3[2]!,
      improving: l3.length === 3 && l3[0]! < l3[1]! && l3[1]! < l3[2]!,
    };
  });
  const scored = areas.filter((a) => a.last !== null);
  const byLast = [...scored].sort((a, b) => b.last! - a.last!);
  return { weeks: sorted.map((w) => w.period), areas, best: byLast[0] ?? null, worst: byLast.at(-1) ?? null, overall: avg(scored.map((a) => a.last!)) };
}
export type ScoreTrends = ReturnType<typeof scoreTrends>;

/** Media por área de las semanas que empiezan en `month`, frente al mes anterior. */
export function monthlyComparison(weeks: WeeklyScores[], month: string) {
  const prev = prevMonth(month);
  const pick = (m: string) => weeks.filter((w) => monthOf(w.period) === m);
  const cur = pick(month), old = pick(prev);
  const areas = SCORE_AREAS.map((a) => {
    const c = avg(cur.map((w) => w.scores[a.id]).filter((v): v is number => typeof v === 'number'));
    const o = avg(old.map((w) => w.scores[a.id]).filter((v): v is number => typeof v === 'number'));
    return { ...a, current: c, previous: o, delta: c !== null && o !== null ? Math.round((c - o) * 10) / 10 : null };
  });
  return { month, previous: prev, weeks: cur.length, previousWeeks: old.length, areas };
}

// ───────────── Alertas proactivas ─────────────

export interface GoalLite { id: string; level: string; area: string; title: string; metric: string | null; nextAction: string | null; dueDate: string | null; progress: number; status: string }
export interface InsightInput {
  todayKey: string;
  goals: GoalLite[];
  lastWeekly: string | null;
  recentDaily: { period: string; mood: number | null; energy: number | null; stress: number | null }[]; // más reciente primero
  trends: ScoreTrends | null;
  health: { sleepAvg: number | null; workoutsWeek: number; workoutTarget: number; daysSinceWorkout: number | null };
  finance: { income: number; expenses: number; savingRate: number; overBudget: string[] };
  overdueTasks: number;
  interview: { answered: number; complete: boolean };
}
export type InsightLevel = 'alert' | 'warn' | 'info';
export interface Insight { id: string; level: InsightLevel; area: GoalArea | 'general'; title: string; detail: string; href: string }

const LEVEL_RANK: Record<InsightLevel, number> = { alert: 0, warn: 1, info: 2 };
const list = (xs: string[], max = 3) => xs.slice(0, max).map((x) => `«${x}»`).join(', ') + (xs.length > max ? ` y ${xs.length - max} más` : '');

/**
 * Observaciones directas (no complacientes) a partir de los datos: foco, objetivos vagos, contradicciones entre lo que
 * dices querer y lo que haces, salud, dinero, procrastinación y tendencias. Ordenadas por gravedad y por la prioridad
 * salud → relaciones → finanzas → trabajo → crecimiento → ocio. Nunca diagnostica.
 */
export function coachInsights(i: InsightInput): Insight[] {
  const out: Insight[] = [];
  const add = (x: Insight) => out.push(x);
  const active = i.goals.filter((g) => g.status === 'active');
  const actionable = active.filter((g) => g.level !== 'vision');
  const quarterly = active.filter((g) => g.level === 'quarterly');

  if (i.interview.answered === 0) add({ id: 'interview-start', level: 'info', area: 'general', title: 'Empieza por la entrevista inicial', detail: 'Son 8 bloques cortos. Con tus respuestas se construye tu mapa de vida y tus 3 objetivos de 90 días.', href: '/coach?tab=mapa' });
  else if (!i.interview.complete) add({ id: 'interview-continue', level: 'info', area: 'general', title: 'Termina la entrevista inicial', detail: `Llevas ${i.interview.answered} respuestas. Sin el cuadro completo, los consejos serán más genéricos.`, href: '/coach?tab=mapa' });

  if (quarterly.length > MAX_FOCUS_GOALS) add({ id: 'too-many-goals', level: 'warn', area: 'general', title: `Persigues ${quarterly.length} objetivos de 90 días a la vez`, detail: `Con más de ${MAX_FOCUS_GOALS} se diluye el foco. Quédate con los ${MAX_FOCUS_GOALS} de más impacto y aparca el resto (no los borres: márcalos como abandonados o pásalos a más adelante).`, href: '/coach?tab=objetivos' });
  else if (quarterly.length === 0 && i.interview.complete) add({ id: 'no-quarterly', level: 'warn', area: 'general', title: 'No tienes objetivos para los próximos 90 días', detail: 'Define 1-3 objetivos medibles. Sin ellos es fácil estar ocupado sin avanzar.', href: '/coach?tab=objetivos' });

  const noAction = actionable.filter((g) => !g.nextAction?.trim());
  if (noAction.length) add({ id: 'no-next-action', level: 'warn', area: 'general', title: `${noAction.length === 1 ? 'Un objetivo no tiene' : `${noAction.length} objetivos no tienen`} próxima acción`, detail: `${list(noAction.map((g) => g.title))}: un objetivo sin próxima acción concreta no avanza.`, href: '/coach?tab=objetivos' });
  const vague = active.filter((g) => (g.level === 'annual' || g.level === 'quarterly') && !g.metric?.trim());
  if (vague.length) add({ id: 'vague-goals', level: 'info', area: 'general', title: 'Objetivos poco medibles', detail: `${list(vague.map((g) => g.title))}: añade una métrica (número y fecha) para saber si avanzas.`, href: '/coach?tab=objetivos' });
  const overdue = actionable.filter((g) => g.dueDate && g.dueDate < i.todayKey && g.progress < 100);
  if (overdue.length) add({ id: 'overdue-goals', level: 'warn', area: 'general', title: `${overdue.length === 1 ? 'Un objetivo ha' : `${overdue.length} objetivos han`} pasado su fecha límite`, detail: `${list(overdue.map((g) => g.title))}: decide si se replantea la fecha, se aplica el plan B o se abandona. Dejarlo así solo resta energía.`, href: '/coach?tab=objetivos' });

  const sinceWeekly = i.lastWeekly ? daysBetween(i.lastWeekly, weekStart(i.todayKey)) : null;
  if ((sinceWeekly === null && actionable.length > 0) || (sinceWeekly !== null && sinceWeekly >= 14)) {
    add({ id: 'weekly-review', level: 'warn', area: 'general', title: sinceWeekly === null ? 'Aún no has hecho ninguna revisión semanal' : `Llevas ${Math.floor(sinceWeekly / 7)} semanas sin revisión semanal`, detail: '15 minutos a la semana para ver qué funciona y fijar la prioridad de la siguiente. Es lo que hace que el sistema funcione.', href: '/coach?tab=revisiones' });
  }

  // Salud
  const h = i.health;
  if (h.sleepAvg !== null && h.sleepAvg < 6.5) add({ id: 'sleep', level: 'alert', area: 'salud', title: `Duermes ${h.sleepAvg.toLocaleString('es-ES')} h de media`, detail: 'El descanso va antes que cualquier objetivo: afecta a energía, ánimo y decisiones. Fija una hora de acostarte y protégela esta semana.', href: '/health' });
  else if (h.sleepAvg !== null && h.sleepAvg < 7) add({ id: 'sleep', level: 'warn', area: 'salud', title: `Duermes ${h.sleepAvg.toLocaleString('es-ES')} h de media`, detail: 'Algo por debajo de lo recomendable (7-9 h). Prueba a adelantar 30 minutos la hora de acostarte.', href: '/health' });
  const healthGoals = active.filter((g) => g.area === 'salud' && g.level !== 'vision');
  const noTraining = h.daysSinceWorkout === null || h.daysSinceWorkout >= 7;
  if (healthGoals.length && noTraining) add({ id: 'health-contradiction', level: 'warn', area: 'salud', title: 'Tu objetivo de salud y tus hechos no coinciden', detail: `Tu objetivo es ${list(healthGoals.map((g) => g.title), 1)}, pero ${h.daysSinceWorkout === null ? 'no hay entrenos registrados' : `llevas ${h.daysSinceWorkout} días sin entrenar`}. ¿Qué te lo impide? Agenda una sesión corta en las próximas 48 h.`, href: '/health' });
  else if (h.workoutTarget > 0 && h.workoutsWeek === 0 && isoWeekday(i.todayKey) >= 4) add({ id: 'no-workouts', level: 'warn', area: 'salud', title: 'Esta semana aún no has entrenado', detail: `Tu meta es ${h.workoutTarget} por semana. Aún da tiempo a hacer al menos una sesión.`, href: '/health' });

  // Bienestar emocional (sin diagnóstico)
  const last3 = i.recentDaily.slice(0, 3);
  if (last3.length === 3 && last3.every((d) => d.mood !== null && d.mood <= 4)) add({ id: 'low-mood', level: 'alert', area: 'salud', title: 'Tu ánimo lleva varios días bajo', detail: 'Cuida lo básico (sueño, movimiento, hablar con alguien de confianza). Si dura más de dos semanas o te cuesta el día a día, consúltalo con tu médico o un psicólogo: es una señal para pedir ayuda, no un fallo.', href: '/coach?tab=revisiones' });
  else if (last3.length >= 2 && last3.slice(0, 2).every((d) => d.stress !== null && d.stress >= 8)) add({ id: 'high-stress', level: 'warn', area: 'salud', title: 'Estrés alto estos días', detail: '¿Qué puedes quitar, aplazar o delegar esta semana? Reserva cada día un rato sin pantallas.', href: '/coach?tab=revisiones' });

  // Relaciones / exceso de trabajo
  const last = (id: ScoreArea) => i.trends?.areas.find((a) => a.id === id)?.last ?? null;
  const work = last('trabajo'), rel = last('relaciones'), rest = last('descanso');
  if (work !== null && work >= 8 && ((rel !== null && rel <= 4) || (rest !== null && rest <= 4))) add({ id: 'overwork', level: 'warn', area: 'relaciones', title: '¿Estás trabajando demasiado?', detail: `Trabajo puntúa ${work}/10, pero ${rel !== null && rel <= 4 ? `relaciones ${rel}/10` : `descanso ${rest}/10`}. El éxito en un área no compensa descuidar las que van antes.`, href: '/coach?tab=revisiones' });

  // Finanzas
  const f = i.finance;
  if (f.income > 0 && f.expenses > f.income) add({ id: 'overspend', level: 'warn', area: 'finanzas', title: 'Este mes gastas más de lo que ingresas', detail: 'Revisa las 2-3 categorías más altas y decide un recorte concreto para lo que queda de mes.', href: '/finance' });
  if (f.overBudget.length) add({ id: 'over-budget', level: 'warn', area: 'finanzas', title: 'Presupuestos superados', detail: `${list(f.overBudget)}.`, href: '/finance?tab=presupuestos' });
  const moneyGoals = active.filter((g) => g.area === 'finanzas' && g.level !== 'vision');
  if (moneyGoals.length && f.income > 0 && f.savingRate <= 0) add({ id: 'money-contradiction', level: 'warn', area: 'finanzas', title: 'Tu objetivo financiero y tu mes no coinciden', detail: `Tu objetivo es ${list(moneyGoals.map((g) => g.title), 1)}, pero este mes no estás ahorrando. Automatiza una transferencia al ahorro el día que cobras.`, href: '/finance' });

  // Productividad
  if (i.overdueTasks >= 5) add({ id: 'procrastination', level: 'warn', area: 'trabajo', title: `Estás posponiendo ${i.overdueTasks} tareas`, detail: '¿Siguen siendo importantes? Elimina las que no, delega lo que puedas y agenda las 3 primeras con hora.', href: '/tasks' });

  // Tendencias
  for (const a of i.trends?.areas ?? []) {
    if (a.declining) add({ id: `declining-${a.id}`, level: 'warn', area: a.id === 'relaciones' ? 'relaciones' : a.id === 'finanzas' ? 'finanzas' : a.id === 'fisica' || a.id === 'descanso' || a.id === 'mental' ? 'salud' : 'crecimiento', title: `${a.emoji} ${a.label} baja tres semanas seguidas`, detail: `Ha pasado de ${a.series.filter((s) => s.value !== null).slice(-3).map((s) => s.value).join(' → ')}. Es un patrón, no un mal día: ¿qué ha cambiado?`, href: '/coach?tab=revisiones' });
  }

  const areaRank = (a: Insight['area']) => (a === 'general' ? -1 : goalAreaRank(a));
  return out.sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level] || areaRank(a.area) - areaRank(b.area));
}

// ───────────── Foco del día ─────────────

export interface FocusTask { id: string; title: string; priority: number; dueKey: string | null; status: string }
/** Las 1-3 cosas importantes de hoy, lo que estás posponiendo y la acción concreta para ahora. */
export function dailyFocus(todayKey: string, tasks: FocusTask[], goals: GoalLite[]) {
  const open = tasks.filter((t) => t.status !== 'done');
  const overdue = open.filter((t) => t.dueKey && t.dueKey < todayKey).sort((a, b) => (a.dueKey ?? '').localeCompare(b.dueKey ?? ''));
  const today = open.filter((t) => t.dueKey === todayKey);
  const ranked = [...today, ...overdue].sort((a, b) => a.priority - b.priority);
  const weeklyActions = goals.filter((g) => g.status === 'active' && g.level === 'weekly' && g.progress < 100).map((g) => ({ id: g.id, title: g.nextAction?.trim() || g.title, kind: 'goal' as const }));
  const important = [...ranked.filter((t) => t.priority === 1).map((t) => ({ id: t.id, title: t.title, kind: 'task' as const })), ...weeklyActions, ...ranked.filter((t) => t.priority !== 1).map((t) => ({ id: t.id, title: t.title, kind: 'task' as const }))].slice(0, 3);
  const quarterAction = goals.filter((g) => g.status === 'active' && g.level === 'quarterly' && g.nextAction?.trim()).sort((a, b) => goalAreaRank(a.area) - goalAreaRank(b.area))[0];
  return {
    important,
    postponed: overdue.slice(0, 5).map((t) => ({ id: t.id, title: t.title, days: daysBetween(t.dueKey!, todayKey) })),
    postponedCount: overdue.length,
    now: important[0]?.title ?? quarterAction?.nextAction ?? null,
  };
}
