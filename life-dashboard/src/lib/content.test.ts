import { describe, expect, it } from 'vitest';
import { contentBoard, isOverdue, normalizeHashtags, type PostLite } from './content';

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
