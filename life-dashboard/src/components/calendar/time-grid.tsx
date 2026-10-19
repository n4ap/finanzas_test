'use client';
import { useEffect, useRef } from 'react';
import { addDaysLocal, layoutDay, sameDay } from '@/lib/calendar';
import { cn, formatTime } from '@/lib/utils';
import type { CalendarDTO, EventDTO } from './types';

const HOUR_PX = 48;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

/** Rejilla horaria para vista Día (1 columna) y Semana (7). Los eventos de día completo van en una franja superior. */
export function TimeGrid({ days, events, calendars, onSelect, onCreate }: { days: Date[]; events: EventDTO[]; calendars: Map<string, CalendarDTO>; onSelect: (e: EventDTO) => void; onCreate: (d: Date) => void }) {
  const today = new Date();
  const scroller = useRef<HTMLDivElement>(null);
  const todayVisible = days.some((d) => sameDay(d, today));
  // Al abrir, desplaza la rejilla a la hora actual (si hoy es visible) o a las 7:00 para no empezar en la madrugada.
  useEffect(() => {
    const hour = todayVisible ? Math.max(0, today.getHours() - 1) : 7;
    if (scroller.current) scroller.current.scrollTop = hour * HOUR_PX;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayVisible, days.length]);
  const timed = events.filter((e) => !e.allDay);
  const allDay = events.filter((e) => e.allDay);
  const cols = `3rem repeat(${days.length}, minmax(0, 1fr))`;
  const color = (e: EventDTO) => calendars.get(e.calendarId)?.color ?? '#6366f1';

  return (
    <div className="overflow-x-auto rounded-2xl border bg-card">
      <div className="min-w-[640px]">
        <div className="grid border-b" style={{ gridTemplateColumns: cols }}>
          <div />
          {days.map((d) => (
            <div key={d.toISOString()} className="border-l px-2 py-2 text-center">
              <p className="text-[11px] uppercase text-muted-foreground">{d.toLocaleDateString('es-ES', { weekday: 'short' })}</p>
              <p className={cn('mx-auto flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium', sameDay(d, today) && 'bg-primary text-primary-foreground')}>{d.getDate()}</p>
            </div>
          ))}
        </div>
        {allDay.length > 0 && (
          <div className="grid border-b" style={{ gridTemplateColumns: cols }}>
            <div className="px-1 py-1 text-[10px] text-muted-foreground">todo el día</div>
            {days.map((d) => (
              <div key={d.toISOString()} className="space-y-0.5 border-l p-1">
                {allDay.filter((e) => new Date(e.startsAt) < addDaysLocal(d, 1) && new Date(e.endsAt) >= d).map((e) => (
                  <button key={e.id} onClick={() => onSelect(e)} className="block w-full truncate rounded px-1.5 py-0.5 text-left text-xs text-white" style={{ background: color(e) }}>{e.title}</button>
                ))}
              </div>
            ))}
          </div>
        )}
        <div ref={scroller} className="max-h-[65vh] overflow-y-auto"><div className="grid" style={{ gridTemplateColumns: cols }}>
          <div>{HOURS.map((h) => <div key={h} style={{ height: HOUR_PX }} className="pr-1 text-right text-[10px] text-muted-foreground"><span className="relative -top-1.5">{h === 0 ? '' : `${String(h).padStart(2, '0')}:00`}</span></div>)}</div>
          {days.map((d) => {
            const placed = layoutDay(timed.map((e) => ({ ...e, id: e.id, start: new Date(e.startsAt), end: new Date(e.endsAt) })), d);
            return (
              <div key={d.toISOString()} className="relative border-l" style={{ height: HOUR_PX * 24 }}>
                {HOURS.map((h) => <button key={h} aria-label={`Crear evento ${d.toLocaleDateString('es-ES')} ${h}:00`} onClick={() => onCreate(new Date(d.getFullYear(), d.getMonth(), d.getDate(), h))} className="block w-full border-t border-border/60 hover:bg-muted/50" style={{ height: HOUR_PX }} />)}
                {sameDay(d, today) && <div className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-danger" style={{ top: `${((today.getHours() * 60 + today.getMinutes()) / 1440) * 100}%` }} />}
                {placed.map(({ item, col, cols: n, top, height }) => (
                  <button key={item.id} onClick={() => onSelect(item)} title={`${item.title} · ${formatTime(item.start)}–${formatTime(item.end)}`}
                    className="absolute overflow-hidden rounded-md border-l-4 px-1.5 py-0.5 text-left text-xs shadow-sm hover:z-20 hover:shadow-md"
                    style={{ top: `${top}%`, height: `max(${height}%, 18px)`, left: `${(col / n) * 100}%`, width: `calc(${100 / n}% - 2px)`, background: `${color(item)}22`, borderColor: color(item) }}>
                    <span className="block truncate font-medium">{item.title}</span>
                    <span className="block truncate text-[10px] text-muted-foreground">{formatTime(item.start)}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div></div>
      </div>
    </div>
  );
}
