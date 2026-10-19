'use client';
import { ArrowDown, ArrowUp, Eye, EyeOff, GripVertical, Maximize2, RotateCcw, Settings2 } from 'lucide-react';
import { useRef, useState, useTransition, type ReactNode } from 'react';
import { Button } from '@/components/ui/primitives';
import { WIDGETS, mergeLayout, type WidgetSize, type WidgetState } from '@/lib/widgets';
import { cn } from '@/lib/utils';
import { resetDashboardLayout, saveDashboardLayout } from '@/server/actions/layout';

const SPAN: Record<WidgetSize, string> = { sm: '', md: 'md:col-span-2', lg: 'md:col-span-2 xl:col-span-3' };
const NEXT_SIZE: Record<WidgetSize, WidgetSize> = { sm: 'md', md: 'lg', lg: 'sm' };
const SIZE_LABEL: Record<WidgetSize, string> = { sm: 'pequeño', md: 'mediano', lg: 'grande' };
const title = (id: string) => WIDGETS.find((w) => w.id === id)?.title ?? id;

export function WidgetGrid({ initial, widgets }: { initial: WidgetState[]; widgets: Record<string, ReactNode> }) {
  const [layout, setLayout] = useState<WidgetState[]>(initial);
  const [editing, setEditing] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [pending, start] = useTransition();
  const dragId = useRef<string | null>(null);

  const commit = (next: WidgetState[]) => {
    const normalized = next.map((w, order) => ({ ...w, order }));
    setLayout(normalized);
    setSaveError(false);
    start(async () => { const r = await saveDashboardLayout(normalized); if (!r.ok) setSaveError(true); });
  };
  const sorted = [...layout].sort((a, b) => a.order - b.order);
  const visible = sorted.filter((w) => w.visible);
  const hidden = sorted.filter((w) => !w.visible);
  const patch = (id: string, p: Partial<WidgetState>) => commit(sorted.map((w) => (w.id === id ? { ...w, ...p } : w)));
  const move = (id: string, dir: -1 | 1) => {
    const ids = visible.map((w) => w.id);
    const i = ids.indexOf(id), j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    commit([...ids.map((x) => sorted.find((w) => w.id === x)!), ...hidden]);
  };
  const dropOn = (targetId: string) => {
    const from = dragId.current;
    dragId.current = null;
    if (!from || from === targetId) return;
    const ids = visible.map((w) => w.id).filter((x) => x !== from);
    ids.splice(ids.indexOf(targetId), 0, from);
    commit([...ids.map((x) => sorted.find((w) => w.id === x)!), ...hidden]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        {saveError && <span role="alert" className="text-xs text-danger">No se pudo guardar</span>}
        {pending && <span className="text-xs text-muted-foreground">Guardando…</span>}
        {editing && <Button variant="ghost" size="sm" onClick={() => start(async () => { await resetDashboardLayout(); setLayout(mergeLayout(null)); })}><RotateCcw size={14} /> Restablecer</Button>}
        <Button variant={editing ? 'primary' : 'outline'} size="sm" onClick={() => setEditing((e) => !e)} aria-pressed={editing}><Settings2 size={14} /> {editing ? 'Hecho' : 'Personalizar'}</Button>
      </div>

      <div className="grid grid-flow-dense grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((w, i) => (
          <div key={w.id}
            draggable={editing}
            onDragStart={() => { dragId.current = w.id; }}
            onDragOver={(e) => editing && e.preventDefault()}
            onDrop={() => dropOn(w.id)}
            className={cn('relative animate-fade-up rounded-2xl border bg-card shadow-sm transition-shadow', SPAN[w.size], editing && 'cursor-grab ring-1 ring-primary/30 hover:shadow-md')}
            style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
            {editing && (
              <div className="absolute right-2 top-2 z-10 flex items-center gap-0.5 rounded-lg border bg-card/95 p-0.5 shadow-sm" role="toolbar" aria-label={`Controles de ${title(w.id)}`}>
                <span className="px-1 text-muted-foreground" aria-hidden><GripVertical size={14} /></span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(w.id, -1)} disabled={i === 0} aria-label="Mover antes"><ArrowUp size={14} /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(w.id, 1)} disabled={i === visible.length - 1} aria-label="Mover después"><ArrowDown size={14} /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => patch(w.id, { size: NEXT_SIZE[w.size] })} aria-label={`Cambiar tamaño (ahora ${SIZE_LABEL[w.size]})`}><Maximize2 size={14} /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => patch(w.id, { visible: false })} aria-label="Ocultar widget"><EyeOff size={14} /></Button>
              </div>
            )}
            {widgets[w.id]}
          </div>
        ))}
      </div>

      {editing && hidden.length > 0 && (
        <div className="rounded-2xl border border-dashed p-4">
          <p className="mb-2 text-sm font-medium">Widgets ocultos</p>
          <div className="flex flex-wrap gap-2">
            {hidden.map((w) => <Button key={w.id} variant="outline" size="sm" onClick={() => patch(w.id, { visible: true })}><Eye size={14} /> {title(w.id)}</Button>)}
          </div>
        </div>
      )}
    </div>
  );
}
