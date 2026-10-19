'use client';
import { ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Button, Input, Segmented } from '@/components/ui/primitives';
import { addDaysLocal, shiftDate, startOfWeek, viewRange, type CalendarViewKind } from '@/lib/calendar';
import { Agenda } from './agenda';
import { CalendarsPanel } from './calendars-panel';
import { EventForm } from './event-form';
import { MonthGrid } from './month-grid';
import { TimeGrid } from './time-grid';
import type { CalendarDTO, EventDTO } from './types';

const dateParam = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function CalendarView({ calendars, events, window: win, initialDate }: { calendars: CalendarDTO[]; events: EventDTO[]; window: { from: string; to: string }; initialDate: string }) {
  const router = useRouter();
  const [view, setView] = useState<CalendarViewKind>('week');
  const [date, setDate] = useState(() => new Date(`${initialDate}T12:00`));
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [showCals, setShowCals] = useState(false); // plegado en móvil; siempre visible en escritorio
  const [form, setForm] = useState<{ open: boolean; event?: EventDTO | null; start?: Date }>({ open: false });

  const calMap = useMemo(() => new Map(calendars.map((c) => [c.id, c])), [calendars]);
  const range = viewRange(view, date);
  const visible = useMemo(() => events.filter((e) => !hidden.has(e.calendarId)), [events, hidden]);
  const inRange = visible.filter((e) => new Date(e.startsAt) < range.to && new Date(e.endsAt) >= range.from);

  const go = (d: Date, v = view) => {
    setDate(d);
    const r = viewRange(v, d);
    // Si el rango sale de lo precargado, recarga la ventana de datos alrededor de la nueva fecha.
    if (r.from < new Date(win.from) || r.to > new Date(win.to)) router.replace(`/calendar?date=${dateParam(d)}`);
  };
  const title = view === 'month' ? date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
    : view === 'day' ? date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
    : view === 'week' ? `${range.from.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} – ${addDaysLocal(range.to, -1).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`
    : 'Próximos 60 días';
  const searching = q.trim().length > 0;
  const found = searching ? visible.filter((e) => [e.title, e.location, e.description, ...e.attendees].some((s) => s?.toLowerCase().includes(q.trim().toLowerCase()))) : [];
  const days = view === 'day' ? [range.from] : Array.from({ length: 7 }, (_, i) => addDaysLocal(startOfWeek(date), i));
  const open = (event: EventDTO) => setForm({ open: true, event });
  const create = (start: Date) => setForm({ open: true, start });

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <aside className="space-y-3 lg:w-52 lg:shrink-0 lg:space-y-4">
        <div className="flex gap-2 lg:block">
          <Button className="flex-1 lg:w-full" onClick={() => create(new Date())}><Plus size={16} /> Nuevo evento</Button>
          <Button variant="outline" className="lg:hidden" aria-expanded={showCals} onClick={() => setShowCals((v) => !v)}>Calendarios ({calendars.length - hidden.size})</Button>
        </div>
        <div className={showCals ? 'block' : 'hidden lg:block'}>
          <CalendarsPanel calendars={calendars} hidden={hidden} onToggle={(id) => setHidden((h) => { const n = new Set(h); if (n.has(id)) n.delete(id); else n.add(id); return n; })} />
        </div>
      </aside>
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => go(new Date())}>Hoy</Button>
          <Button variant="outline" size="icon" onClick={() => go(shiftDate(view, date, -1))} aria-label="Anterior"><ChevronLeft size={16} /></Button>
          <Button variant="outline" size="icon" onClick={() => go(shiftDate(view, date, 1))} aria-label="Siguiente"><ChevronRight size={16} /></Button>
          <h1 className="text-lg font-semibold capitalize" aria-live="polite">{title}</h1>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="relative"><Search size={14} className="absolute left-3 top-3 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar eventos…" className="w-44 pl-8" aria-label="Buscar eventos" /></div>
            <Segmented label="Vista del calendario" value={view} onChange={(v) => { setView(v); go(date, v); }} options={[{ value: 'day', label: 'Día' }, { value: 'week', label: 'Semana' }, { value: 'month', label: 'Mes' }, { value: 'agenda', label: 'Agenda' }]} />
          </div>
        </div>
        {searching ? <Agenda events={found} calendars={calMap} onSelect={open} empty={`Sin resultados para «${q}»`} />
          : view === 'agenda' ? <Agenda events={inRange} calendars={calMap} onSelect={open} />
          : view === 'month' ? <MonthGrid from={range.from} to={range.to} month={date.getMonth()} events={inRange} calendars={calMap} onSelect={open} onCreate={create} />
          : <TimeGrid days={days} events={inRange} calendars={calMap} onSelect={open} onCreate={create} />}
      </div>
      <EventForm open={form.open} onClose={() => setForm({ open: false })} event={form.event} defaultStart={form.start} calendars={calendars} />
    </div>
  );
}
