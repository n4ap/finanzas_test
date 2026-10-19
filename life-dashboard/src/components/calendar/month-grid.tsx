'use client';
import { addDaysLocal, sameDay } from '@/lib/calendar';
import { cn, formatTime } from '@/lib/utils';
import type { CalendarDTO, EventDTO } from './types';

const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export function MonthGrid({ from, to, month, events, calendars, onSelect, onCreate }: { from: Date; to: Date; month: number; events: EventDTO[]; calendars: Map<string, CalendarDTO>; onSelect: (e: EventDTO) => void; onCreate: (d: Date) => void }) {
  const total = Math.round((to.getTime() - from.getTime()) / 86_400_000);
  const days = Array.from({ length: total }, (_, i) => addDaysLocal(from, i));
  const today = new Date();
  return (
    <div className="grid grid-cols-7 gap-px overflow-hidden rounded-2xl border bg-border text-xs">
      {DOW.map((d) => <div key={d} className="bg-muted px-2 py-1.5 text-center font-medium text-muted-foreground">{d}</div>)}
      {days.map((d) => {
        const dayEnd = addDaysLocal(d, 1);
        const items = events.filter((e) => new Date(e.startsAt) < dayEnd && new Date(e.endsAt) >= d && !(new Date(e.endsAt).getTime() === d.getTime()));
        return (
          <div key={d.toISOString()} className={cn('min-h-20 bg-card p-1 sm:min-h-28', d.getMonth() !== month && 'bg-muted/40 text-muted-foreground')}>
            <button onClick={() => onCreate(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9))} aria-label={`Crear evento el ${d.toLocaleDateString('es-ES')}`}
              className={cn('mb-1 flex h-6 w-6 items-center justify-center rounded-full hover:bg-muted', sameDay(d, today) && 'bg-primary text-primary-foreground hover:bg-primary')}>{d.getDate()}</button>
            <ul className="space-y-0.5">
              {items.slice(0, 3).map((e) => (
                <li key={e.id}><button onClick={() => onSelect(e)} className="flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left hover:bg-muted">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: calendars.get(e.calendarId)?.color }} />
                  <span className="truncate">{!e.allDay && <span className="mr-1 text-muted-foreground">{formatTime(new Date(e.startsAt))}</span>}{e.title}</span>
                </button></li>
              ))}
              {items.length > 3 && <li className="px-1 text-muted-foreground">+{items.length - 3} más</li>}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
