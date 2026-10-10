import { describe, expect, it } from 'vitest';
import { analyzeEmail, classifyEmail, detectNeedsReply, draftReply, extractDeadline, extractTasks } from './email-ai';

const now = new Date(2026, 9, 5, 10, 0); // lunes 5/10/2026

describe('extractDeadline', () => {
  it('«antes del viernes» → viernes de esta semana', () => {
    const d = extractDeadline('Necesito tu confirmación antes del viernes para cerrar.', now)!;
    expect(d.getDay()).toBe(5);
    expect(d.getDate()).toBe(9);
  });
  it('respeta la hora indicada', () => {
    const d = extractDeadline('Necesitamos el informe antes del jueves a las 17:00. Gracias.', now)!;
    expect([d.getDay(), d.getHours()]).toEqual([4, 17]);
  });
  it('fechas numéricas y largas, pasando al año siguiente si ya pasaron', () => {
    expect(extractDeadline('Fecha límite 15/10', now)!.getDate()).toBe(15);
    expect(extractDeadline('Responde antes del 20 de octubre.', now)!.getMonth()).toBe(9);
    expect(extractDeadline('Vence el 1/3', now)!.getFullYear()).toBe(2027);
  });
  it('mañana, hoy y «en N días» con cue', () => {
    expect(extractDeadline('Envíalo antes de mañana', now)!.getDate()).toBe(6);
    expect(extractDeadline('Tu póliza vence en 12 días', now)!.getDate()).toBe(17);
  });
  it('no inventa fechas sin señal de plazo', () => {
    expect(extractDeadline('Nos vemos el viernes en la cena, ¿vale?', now)).toBeNull();
    expect(extractDeadline('Hola, ¿qué tal todo?', now)).toBeNull();
  });
});

describe('detectNeedsReply', () => {
  it('detecta peticiones y preguntas', () => {
    expect(detectNeedsReply({ fromEmail: 'a@x.test', subject: 'Contrato', body: 'Necesito tu confirmación.' })).toBe(true);
    expect(detectNeedsReply({ fromEmail: 'a@x.test', subject: 'Comida', body: '¿Seguimos a las 14:00?' })).toBe(true);
  });
  it('ignora automáticos e informativos', () => {
    expect(detectNeedsReply({ fromEmail: 'news@iasemanal.test', subject: 'Novedades', body: '¿Sabías que…?' })).toBe(false);
    expect(detectNeedsReply({ fromEmail: 'avisos@banco.test', subject: 'Recibo', body: 'No es necesaria ninguna acción.' })).toBe(false);
  });
});

describe('classifyEmail', () => {
  it.each([
    ['Recibo de la hipoteca disponible', 'Se cargará el día 5', 'finanzas'],
    ['Tu vuelo a Lisboa: check-in', 'Localizador XK29PL', 'viajes'],
    ['Propuesta de contrato', 'Adjunto la propuesta', 'trabajo'],
    ['Los 5 avances de IA', 'Newsletter semanal', 'newsletter'],
    ['Re: comida de hoy', '¿Seguimos a las 14:00?', 'personal'],
  ])('«%s» → %s', (subject, body, cat) => {
    expect(classifyEmail({ fromEmail: 'x@y.test', subject, body })).toBe(cat);
  });
});

describe('extractTasks y borradores', () => {
  it('extrae tareas con su fecha', () => {
    const t = extractTasks({ subject: 'Informe', body: 'Hola Alex. Recuerda que necesitamos el informe antes del jueves a las 17:00. Gracias.' }, now);
    expect(t).toHaveLength(1);
    expect(t[0]!.dueDate!.getDay()).toBe(4);
  });
  it('genera una tarea de respuesta si solo requiere contestar', () => {
    const t = extractTasks({ subject: 'Comida', body: '¿Seguimos a las 14:00?' }, now);
    expect(t[0]!.title).toBe('Responder: Comida');
  });
  it('el borrador es texto con marcadores para completar y usa el nombre del remitente', () => {
    const d = draftReply({ fromName: 'Ana García', subject: 'Propuesta de contrato', body: 'Necesito tu confirmación antes del viernes.' }, 'Alex', now);
    expect(d.subject).toBe('Re: Propuesta de contrato');
    expect(d.body).toContain('Hola Ana');
    expect(d.body).toContain('viernes');
    expect(d.body).toContain('[');
  });
});

describe('analyzeEmail', () => {
  it('combina resumen con fecha límite', () => {
    const a = analyzeEmail({ fromName: 'Ana', fromEmail: 'ana@x.test', subject: 'Contrato', body: 'Adjunto la propuesta final. Necesito tu confirmación antes del viernes.' }, now);
    expect(a.needsReply).toBe(true);
    expect(a.category).toBe('trabajo');
    expect(a.summary).toContain('Fecha límite');
  });
});
