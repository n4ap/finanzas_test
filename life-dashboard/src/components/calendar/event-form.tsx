'use client';
import { useState, useTransition } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button, Field, Input, Select, Textarea } from '@/components/ui/primitives';
import { createEvent, deleteEvent, updateEvent } from '@/server/actions/calendar';
import type { CalendarDTO, EventDTO } from './types';

const pad = (n: number) => String(n).padStart(2, '0');
/** ISO → valor de <input datetime-local> / <input date> en hora local. */
const toLocal = (iso: string, dateOnly: boolean) => {
  const d = new Date(iso);
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return dateOnly ? date : `${date}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function EventForm({ open, onClose, event, calendars, defaultStart }: { open: boolean; onClose: () => void; event?: EventDTO | null; calendars: CalendarDTO[]; defaultStart?: Date }) {
  const [allDay, setAllDay] = useState(event?.allDay ?? false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const editing = !!event;
  const initStart = event?.startsAt ?? (defaultStart ?? new Date()).toISOString();
  const initEnd = event?.endsAt ?? new Date(new Date(initStart).getTime() + 3_600_000).toISOString();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const s = String(f.get('startsAt')), en = String(f.get('endsAt'));
    // Un evento de día completo ocupa de 00:00 del primer día a 23:59 del último, en hora local del navegador.
    const startsAt = allDay ? new Date(`${s}T00:00`) : new Date(s);
    const endsAt = allDay ? new Date(`${en || s}T23:59`) : new Date(en);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) { setError('Fechas no válidas'); return; }
    const payload = {
      calendarId: f.get('calendarId'), title: f.get('title'), description: f.get('description') || undefined, location: f.get('location') || undefined,
      startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), allDay, important: f.get('important') === 'on',
      attendees: String(f.get('attendees') ?? '').split(',').map((a) => a.trim()).filter(Boolean),
    };
    start(async () => {
      const r = editing ? await updateEvent(event!.id, payload) : await createEvent(payload);
      if (r.ok) { setError(null); onClose(); } else setError(r.error);
    });
  };

  return (
    <Dialog open={open} onClose={onClose} title={editing ? 'Editar evento' : 'Nuevo evento'}>
      <form key={(event?.id ?? 'new') + initStart} onSubmit={submit} className="space-y-3">
        <Field label="Título"><Input name="title" defaultValue={event?.title} required maxLength={200} autoFocus /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Calendario"><Select name="calendarId" defaultValue={event?.calendarId ?? calendars.find((c) => c.isDefault)?.id ?? calendars[0]?.id}>{calendars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
          <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} /> Todo el día</label>
          <Field label={allDay ? 'Desde' : 'Inicio'}><Input key={String(allDay)} name="startsAt" type={allDay ? 'date' : 'datetime-local'} defaultValue={toLocal(initStart, allDay)} required /></Field>
          <Field label={allDay ? 'Hasta' : 'Fin'}><Input key={String(allDay)} name="endsAt" type={allDay ? 'date' : 'datetime-local'} defaultValue={toLocal(initEnd, allDay)} required /></Field>
        </div>
        <Field label="Ubicación"><Input name="location" defaultValue={event?.location ?? ''} maxLength={200} /></Field>
        <Field label="Participantes (separados por comas)"><Input name="attendees" defaultValue={event?.attendees.join(', ')} placeholder="ana@ejemplo.com, luis@ejemplo.com" /></Field>
        <Field label="Descripción"><Textarea name="description" defaultValue={event?.description ?? ''} maxLength={2000} /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="important" defaultChecked={event?.important} /> Evento importante</label>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-between pt-2">
          {editing ? <Button type="button" variant="ghost" className="text-danger" disabled={pending} onClick={() => { if (confirm('¿Eliminar este evento?')) start(async () => { const r = await deleteEvent(event!.id); if (r.ok) onClose(); else setError(r.error); }); }}>Eliminar</Button> : <span />}
          <div className="flex gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Guardar'}</Button></div>
        </div>
      </form>
    </Dialog>
  );
}
