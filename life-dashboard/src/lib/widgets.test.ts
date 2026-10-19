import { describe, expect, it } from 'vitest';
import { WIDGETS, defaultLayout, mergeLayout } from './widgets';

describe('mergeLayout', () => {
  it('devuelve el layout por defecto sin configuración', () => {
    expect(mergeLayout(null)).toEqual(defaultLayout());
  });
  it('respeta orden y visibilidad guardados, añade widgets nuevos y descarta desconocidos', () => {
    const saved = [
      { id: 'tasks', visible: true, order: 0, size: 'lg' as const },
      { id: 'myday', visible: false, order: 1, size: 'md' as const },
      { id: 'borrado', visible: true, order: 2, size: 'sm' as const },
    ];
    const m = mergeLayout(saved);
    expect(m).toHaveLength(WIDGETS.length);
    expect(m[0]).toMatchObject({ id: 'tasks', size: 'lg' });
    expect(m.find((w) => w.id === 'myday')?.visible).toBe(false);
    expect(m.some((w) => w.id === 'borrado')).toBe(false);
    expect(m.map((w) => w.order)).toEqual(m.map((_, i) => i));
  });
});
