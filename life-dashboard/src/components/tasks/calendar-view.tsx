'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import { localDateKey } from './task-meta';
import type { TaskDTO } from './types';

const DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const key = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** Vista mensual de tareas por fecha límite. */
export function TaskCalendarView({ tasks, onEdit, onCreate }: { tasks: TaskDTO[]; onEdit: (t: TaskDTO) => void; onCreate: (dueDate: string) => void }) {
  const [cursor, setCursor] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const y = cursor.getFullYear(), m = cursor.getMonth();
  const lead = (new Date(y, m, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((lead + daysInMonth) / 7) * 7 }, (_, i) => (i < lead || i >= lead + daysInMonth ? null : i - lead + 1));
  const byDay = new Map<string, TaskDTO[]>();
  for (const t of tasks) if (t.dueDate && !t.parentId) byDay.set(t.dueDate.slice(0, 10), [...(byDay.get(t.dueDate.slice(0, 10)) ?? []), t]);
  const todayKey = localDateKey();
  const label = cursor.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => setCursor(new Date(y, m - 1, 1))} aria-label="Mes anterior"><ChevronLeft size={16} /></Button>
        <h3 className="min-w-40 text-center font-medium capitalize">{label}</h3>
        <Button variant="outline" size="icon" onClick={() => setCursor(new Date(y, m + 1, 1))} aria-label="Mes siguiente"><ChevronRight size={16} /></Button>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-2xl border bg-border text-xs">
        {DAYS.map((d) => <div key={d} className="bg-muted px-2 py-1.5 text-center font-medium text-muted-foreground">{d}</div>)}
        {cells.map((d, i) => {
          const k = d ? key(y, m, d) : '';
          const items = d ? byDay.get(k) ?? [] : [];
          return (
            <div key={i} className={cn('min-h-20 bg-card p-1 sm:min-h-24', !d && 'bg-muted/40')}>
              {d && (
                <>
                  <button onClick={() => onCreate(k)} aria-label={`Nueva tarea el día ${d}`} className={cn('mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs hover:bg-muted', k === todayKey && 'bg-primary text-primary-foreground hover:bg-primary')}>{d}</button>
                  <ul className="space-y-0.5">
                    {items.slice(0, 3).map((t) => (
                      <li key={t.id}><button onClick={() => onEdit(t)} className={cn('block w-full truncate rounded px-1 py-0.5 text-left', t.status === 'done' ? 'bg-muted text-muted-foreground line-through' : t.priority === 1 ? 'bg-danger/15 text-danger' : 'bg-primary/10 text-primary')}>{t.title}</button></li>
                    ))}
                    {items.length > 3 && <li className="px-1 text-muted-foreground">+{items.length - 3} más</li>}
                  </ul>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
