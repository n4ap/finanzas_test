'use client';
import { useRouter } from 'next/navigation';
import { Dialog } from '@/components/ui/dialog';
import { Button, Field, Input, Select, Textarea } from '@/components/ui/primitives';
import { useRun } from '@/components/ui/use-run';
import { BOOKING_KINDS, BOOKING_LABEL } from '@/lib/travel';
import { addBookingAction, addItineraryAction, createTripAction, deleteBookingAction, deleteItineraryAction, deleteTripAction, updateBookingAction, updateItineraryAction, updateTripAction } from '@/server/actions/travel';

const pad = (n: number) => String(n).padStart(2, '0');
const toLocalInput = (iso: string | null) => { if (!iso) return ''; const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const iso = (v: FormDataEntryValue | null) => (v ? new Date(String(v)).toISOString() : '');
const dec = (v: FormDataEntryValue | null) => String(v ?? '').replace(',', '.');
const footer = (onClose: () => void, pending: boolean, left?: React.ReactNode) => (
  <div className="flex justify-between pt-2">{left ?? <span />}<div className="flex gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Guardar'}</Button></div></div>
);

export interface TripFormValue { id: string; name: string; destination: string; startDate: string; endDate: string; budgetAmount: number | null; notes: string | null }

export function TripForm({ open, onClose, trip }: { open: boolean; onClose: () => void; trip?: TripFormValue | null }) {
  const { pending, error, run } = useRun();
  const router = useRouter();
  const editing = !!trip;
  return (
    <Dialog open={open} onClose={onClose} title={editing ? 'Editar viaje' : 'Nuevo viaje'}>
      <form key={trip?.id ?? 'new'} className="space-y-3" onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const payload = { name: f.get('name'), destination: f.get('destination'), startDate: f.get('startDate'), endDate: f.get('endDate'), budget: dec(f.get('budget')), notes: f.get('notes') };
        run(() => (editing ? updateTripAction(trip!.id, payload) : createTripAction(payload)), (id) => { onClose(); if (!editing && typeof id === 'string') router.push(`/travel/${id}`); });
      }}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nombre" className="col-span-2"><Input name="name" required maxLength={100} defaultValue={trip?.name} autoFocus /></Field>
          <Field label="Destino" className="col-span-2"><Input name="destination" required maxLength={100} defaultValue={trip?.destination} /></Field>
          <Field label="Salida"><Input name="startDate" type="date" required defaultValue={trip?.startDate} /></Field>
          <Field label="Vuelta"><Input name="endDate" type="date" required defaultValue={trip?.endDate} /></Field>
          <Field label="Presupuesto (€)" className="col-span-2"><Input name="budget" inputMode="decimal" defaultValue={trip?.budgetAmount ?? ''} placeholder="Opcional" /></Field>
        </div>
        <Field label="Notas"><Textarea name="notes" maxLength={2000} defaultValue={trip?.notes ?? ''} /></Field>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        {footer(onClose, pending, editing ? <Button type="button" variant="ghost" className="text-danger" disabled={pending} onClick={() => { if (confirm(`¿Eliminar «${trip!.name}» con sus reservas, itinerario y maleta?`)) run(() => deleteTripAction(trip!.id), () => { onClose(); router.push('/travel'); }); }}>Eliminar</Button> : undefined)}
      </form>
    </Dialog>
  );
}

export interface BookingValue { id: string; kind: string; title: string; reference: string | null; startsAt: string | null; endsAt: string | null; cost: number | null; details: string | null }

export function BookingForm({ open, onClose, tripId, booking }: { open: boolean; onClose: () => void; tripId: string; booking?: BookingValue | null }) {
  const { pending, error, run } = useRun();
  const editing = !!booking;
  return (
    <Dialog open={open} onClose={onClose} title={editing ? 'Editar reserva' : 'Nueva reserva'}>
      <form key={booking?.id ?? 'new'} className="space-y-3" onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const payload = { kind: f.get('kind'), title: f.get('title'), reference: f.get('reference'), startsAt: iso(f.get('startsAt')), endsAt: iso(f.get('endsAt')), cost: dec(f.get('cost')), details: f.get('details') };
        run(() => (editing ? updateBookingAction(booking!.id, payload) : addBookingAction(tripId, payload)), () => onClose());
      }}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo"><Select name="kind" defaultValue={booking?.kind ?? 'flight'}>{BOOKING_KINDS.map((k) => <option key={k} value={k}>{BOOKING_LABEL[k]}</option>)}</Select></Field>
          <Field label="Referencia"><Input name="reference" maxLength={60} defaultValue={booking?.reference ?? ''} placeholder="Código de reserva" /></Field>
          <Field label="Título" className="col-span-2"><Input name="title" required maxLength={120} defaultValue={booking?.title} autoFocus /></Field>
          <Field label="Inicio"><Input name="startsAt" type="datetime-local" defaultValue={toLocalInput(booking?.startsAt ?? null)} /></Field>
          <Field label="Fin"><Input name="endsAt" type="datetime-local" defaultValue={toLocalInput(booking?.endsAt ?? null)} /></Field>
          <Field label="Coste (€)" className="col-span-2"><Input name="cost" inputMode="decimal" defaultValue={booking?.cost ?? ''} /></Field>
        </div>
        <Field label="Detalles"><Textarea name="details" maxLength={500} defaultValue={booking?.details ?? ''} /></Field>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        {footer(onClose, pending, editing ? <Button type="button" variant="ghost" className="text-danger" disabled={pending} onClick={() => { if (confirm('¿Eliminar esta reserva?')) run(() => deleteBookingAction(booking!.id), () => onClose()); }}>Eliminar</Button> : undefined)}
      </form>
    </Dialog>
  );
}

export interface ItemValue { id: string; date: string; time: string | null; title: string; notes: string | null }

export function ItineraryForm({ open, onClose, tripId, dayKeys, item, defaultDate }: { open: boolean; onClose: () => void; tripId: string; dayKeys: string[]; item?: ItemValue | null; defaultDate?: string }) {
  const { pending, error, run } = useRun();
  const editing = !!item;
  const label = (k: string, i: number) => `Día ${i + 1} · ${new Date(`${k}T12:00:00Z`).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })}`;
  return (
    <Dialog open={open} onClose={onClose} title={editing ? 'Editar plan' : 'Añadir al itinerario'}>
      <form key={item?.id ?? `new-${defaultDate}`} className="space-y-3" onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const payload = { date: f.get('date'), time: f.get('time'), title: f.get('title'), notes: f.get('notes') };
        run(() => (editing ? updateItineraryAction(item!.id, payload) : addItineraryAction(tripId, payload)), () => onClose());
      }}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Día"><Select name="date" defaultValue={item?.date ?? defaultDate ?? dayKeys[0]}>{dayKeys.map((k, i) => <option key={k} value={k}>{label(k, i)}</option>)}</Select></Field>
          <Field label="Hora (opcional)"><Input name="time" type="time" defaultValue={item?.time ?? ''} /></Field>
          <Field label="Plan" className="col-span-2"><Input name="title" required maxLength={150} defaultValue={item?.title} autoFocus /></Field>
        </div>
        <Field label="Notas"><Textarea name="notes" maxLength={500} defaultValue={item?.notes ?? ''} /></Field>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        {footer(onClose, pending, editing ? <Button type="button" variant="ghost" className="text-danger" disabled={pending} onClick={() => { if (confirm('¿Eliminar este plan?')) run(() => deleteItineraryAction(item!.id), () => onClose()); }}>Eliminar</Button> : undefined)}
      </form>
    </Dialog>
  );
}
