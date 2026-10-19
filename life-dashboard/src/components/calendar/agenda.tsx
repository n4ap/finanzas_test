'use client';
import { MapPin, Users } from 'lucide-react';
import { Badge, EmptyState } from '@/components/ui/primitives';
import { formatTime, relativeDay } from '@/lib/utils';
import type { CalendarDTO, EventDTO } from './types';

export function Agenda({ events, calendars, onSelect, empty }: { events: EventDTO[]; calendars: Map<string, CalendarDTO>; onSelect: (e: EventDTO) => void; empty?: string }) {
  if (events.length === 0) return <EmptyState title={empty ?? 'Sin eventos en este periodo'} />;
  const groups = new Map<string, EventDTO[]>();
  for (const e of [...events].sort((a, b) => a.startsAt.localeCompare(b.startsAt))) {
    const k = new Date(e.startsAt).toDateString();
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }
  return (
    <div className="space-y-4">
      {[...groups].map(([k, list]) => {
        const d = new Date(k);
        return (
          <section key={k}>
            <h3 className="mb-1 text-sm font-semibold capitalize">{d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })} <span className="font-normal text-muted-foreground">· {relativeDay(d)}</span></h3>
            <ul className="divide-y rounded-2xl border bg-card px-3">
              {list.map((e) => (
                <li key={e.id}>
                  <button onClick={() => onSelect(e)} className="flex w-full items-start gap-3 py-2.5 text-left">
                    <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: calendars.get(e.calendarId)?.color }} />
                    <span className="w-24 shrink-0 text-sm tabular-nums text-muted-foreground">{e.allDay ? 'Todo el día' : `${formatTime(new Date(e.startsAt))}–${formatTime(new Date(e.endsAt))}`}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-sm font-medium">{e.title}{e.important && <Badge tone="important">Importante</Badge>}</span>
                      {(e.location || e.attendees.length > 0) && (
                        <span className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                          {e.location && <span className="flex items-center gap-1"><MapPin size={11} />{e.location}</span>}
                          {e.attendees.length > 0 && <span className="flex items-center gap-1"><Users size={11} />{e.attendees.length}</span>}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
