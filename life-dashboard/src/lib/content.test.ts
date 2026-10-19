import { describe, expect, it } from 'vitest';
import { competitorTrend, contentAnalytics, contentBoard, dayKeyOf, isOverdue, matchKeywords, monthGrid, normalizeHashtags, shiftMonth, type PostLite, type PostStats } from './content';

const now = new Date('2026-10-19T10:00:00Z');
const p = (title: string, o: Partial<PostLite>): PostLite => ({ title, status: 'idea', scheduledAt: null, publishedAt: null, createdAt: '2026-10-01T10:00:00Z', ...o });

describe('contentBoard', () => {
  const posts = [
    p('futura', { status: 'scheduled', scheduledAt: '2026-10-25T18:00:00Z' }),
    p('pronto', { status: 'scheduled', scheduledAt: '2026-10-20T18:00:00Z' }),
    p('atrasada', { status: 'scheduled', scheduledAt: '2026-10-18T18:00:00Z' }),
    p('idea vieja', { status: 'idea', createdAt: '2026-09-01T10:00:00Z' }),
    p('borrador', { status: 'draft', createdAt: '2026-10-10T10:00:00Z' }),
    p('subida', { status: 'published', publishedAt: '2026-10-15T10:00:00Z' }),
    p('subida antes', { status: 'published', publishedAt: '2026-10-05T10:00:00Z' }),
  ];
  const b = contentBoard(posts, now);
  it('reparte por estado y ordena cada sección', () => {
    expect(b.scheduled.map((x) => x.title)).toEqual(['atrasada', 'pronto', 'futura']);
    expect(b.drafts.map((x) => x.title)).toEqual(['borrador', 'idea vieja']);
    expect(b.published.map((x) => x.title)).toEqual(['subida', 'subida antes']);
  });
  it('pendientes: atrasadas primero, luego por fecha, sin fecha al final', () => {
    expect(b.pending.map((x) => x.title)).toEqual(['atrasada', 'pronto', 'futura', 'idea vieja', 'borrador']);
  });
  it('contadores', () => {
    expect(b.stats).toEqual({ scheduled: 3, drafts: 2, published: 2, pending: 5, overdue: 1, thisWeek: 2 });
  });
});

describe('piezas', () => {
  it('atrasada solo si está programada y la fecha ya pasó', () => {
    expect(isOverdue({ status: 'scheduled', scheduledAt: '2026-10-19T09:59:00Z' }, now)).toBe(true);
    expect(isOverdue({ status: 'scheduled', scheduledAt: '2026-10-19T10:01:00Z' }, now)).toBe(false);
    expect(isOverdue({ status: 'draft', scheduledAt: '2026-10-01T10:00:00Z' }, now)).toBe(false);
  });
  it('hashtags: añade #, separa por espacios o comas y quita repetidos', () => {
    expect(normalizeHashtags('viaje, #Zaragoza  ##aviones;zaragoza')).toBe('#viaje #Zaragoza #aviones');
    expect(normalizeHashtags('  ')).toBe('');
  });
});

describe('calendario', () => {
  it('semanas de lunes a domingo que cubren el mes', () => {
    const g = monthGrid('2026-10'); // el 1 de octubre de 2026 es jueves
    expect(g[0]).toEqual(['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
    expect(g.at(-1)!.at(-1)).toBe('2026-11-01');
    expect(g).toHaveLength(5);
    expect(monthGrid('2027-02')).toHaveLength(4); // febrero 2027 empieza en lunes y tiene 28 días → 4 semanas justas
  });
  it('cambiar de mes y día en hora de España', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(dayKeyOf('2026-10-19T22:30:00Z')).toBe('2026-10-20'); // 00:30 en Madrid
  });
});

describe('análisis', () => {
  const s = (o: Partial<PostStats>): PostStats => ({ id: Math.random().toString(), title: 't', platform: 'youtube', type: 'video', status: 'published', scheduledAt: null, publishedAt: '2026-10-12T17:00:00Z', createdAt: '2026-10-01T00:00:00Z', views: null, likes: null, comments: null, shares: null, ...o });
  const posts = [
    s({ title: 'A', views: 1000, likes: 80, comments: 10, shares: 10, publishedAt: '2026-10-12T17:00:00Z' }), // lunes
    s({ title: 'B', views: 3000, likes: 100, comments: 50, shares: 50, type: 'short', publishedAt: '2026-10-17T17:00:00Z' }), // sábado
    s({ title: 'C', publishedAt: '2026-10-18T10:00:00Z' }), // sin resultados
    s({ title: 'D', views: 500, platform: 'tiktok', publishedAt: '2026-10-13T10:00:00Z' }),
    s({ title: 'vieja', views: 9999, publishedAt: '2026-01-01T10:00:00Z' }),
    s({ title: 'borrador', status: 'draft', publishedAt: null }),
  ];
  it('totales, media e interacción del periodo y la plataforma', () => {
    const a = contentAnalytics(posts, { platform: 'youtube', days: 30 }, now);
    expect(a).toMatchObject({ published: 3, measured: 2, views: 4000, avgViews: 2000, bestWeekday: 'Sábado' });
    expect(a.engagement).toBeCloseTo(300 / 4000);
    expect(a.top.map((p) => p.title)).toEqual(['B', 'A']);
    expect(a.byType).toEqual([{ type: 'short', posts: 1, avgViews: 3000 }, { type: 'video', posts: 2, avgViews: 1000 }]);
    expect(a.weekly).toHaveLength(12);
    expect(a.weekly.at(-2)).toMatchObject({ week: '2026-10-12', posts: 3, views: 4000 });
  });
  it('todas las plataformas y todo el tiempo', () => {
    expect(contentAnalytics(posts, { platform: null, days: null }, now)).toMatchObject({ published: 5, measured: 4 });
  });
});

describe('competencia', () => {
  it('cambio desde el dato anterior y crecimiento en ~30 días', () => {
    const t = competitorTrend([
      { date: '2026-10-15', followers: 1300, avgViews: 200, posts: null },
      { date: '2026-09-15', followers: 1000, avgViews: null, posts: null },
      { date: '2026-10-12', followers: 1250, avgViews: null, posts: null },
    ]);
    expect(t).toMatchObject({ change: 50, growth30: 300 });
    expect(t.growth30Pct).toBeCloseTo(0.3);
    expect(competitorTrend([{ date: '2026-10-15', followers: 10, avgViews: null, posts: null }])).toMatchObject({ change: null, growth30: null });
    expect(competitorTrend([])).toMatchObject({ last: null });
  });
});

describe('noticias del sector', () => {
  it('palabras completas, sin tildes ni mayúsculas, sin repetir', () => {
    expect(matchKeywords('Nuevo récord de la AVIACION en YouTube Shorts', ['aviación', 'youtube', 'YouTube', 'tok', 'shorts'])).toEqual(['aviación', 'youtube', 'shorts']);
    expect(matchKeywords('TikTokers', ['TikTok'])).toEqual([]);
    expect(matchKeywords('C++ (lenguaje)', ['c++'])).toEqual(['c++']);
  });
});
