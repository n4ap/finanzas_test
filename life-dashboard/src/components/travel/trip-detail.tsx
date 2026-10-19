'use client';
import { ArrowLeft, CalendarDays, Check, Hotel, Pencil, Plane, Plus, Ticket, TrainFront, Car, Trash2, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Meter } from '@/components/charts/bars';
import { Badge, Button, Card, EmptyState, Input, Segmented } from '@/components/ui/primitives';
import { useRun } from '@/components/ui/use-run';
import { BOOKING_LABEL, PHASE_LABEL, type BookingKind } from '@/lib/travel';
import { cn, formatEUR, formatEURExact } from '@/lib/utils';
import { addDefaultPackingAction, addPackingAction, deletePackingAction, setPackedAction } from '@/server/actions/travel';
import type { TripDetailDTO } from '@/server/life/queries';
import { BookingForm, ItineraryForm, TripForm, type BookingValue, type ItemValue } from './forms';
import { countdown, fmtRange } from './trips-view';

type Tab = 'plan' | 'bookings' | 'packing';
const ICON: Record<BookingKind, LucideIcon> = { flight: Plane, hotel: Hotel, train: TrainFront, car: Car, activity: Ticket };
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : null);
const dayName = (k: string) => { const t = new Date(`${k}T12:00:00Z`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }); return t.charAt(0).toUpperCase() + t.slice(1); };

export function TripDetail({ trip }: { trip: TripDetailDTO }) {
  const [tab, setTab] = useState<Tab>('plan');
  const [edit, setEdit] = useState(false);
  const [booking, setBooking] = useState<{ open: boolean; value?: BookingValue | null }>({ open: false });
  const [plan, setPlan] = useState<{ open: boolean; item?: ItemValue | null; date?: string }>({ open: false });
  const b = trip.budget;
  const packed = trip.packing.filter((p) => p.packed).length;
  return (
    <div className="space-y-4">
      <Link href="/travel" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={14} /> Viajes</Link>
      <Card className="p-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold">{trip.name}</h1>
            <p className="text-sm text-muted-foreground">{trip.destination}</p>
          </div>
          <Badge tone={trip.phase === 'ongoing' ? 'success' : trip.phase === 'upcoming' ? 'primary' : 'neutral'}>{PHASE_LABEL[trip.phase]}</Badge>
          <Button variant="outline" size="sm" onClick={() => setEdit(true)}><Pencil size={14} /> Editar</Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="flex items-center gap-1.5"><CalendarDays size={14} aria-hidden className="text-muted-foreground" />{fmtRange(trip.startDate, trip.endDate)} · {trip.dayKeys.length} {trip.dayKeys.length === 1 ? 'día' : 'días'}</span>
          <span className="font-medium">{countdown(trip.phase, trip.daysUntil)}</span>
        </div>
        <div className="mt-4 max-w-md space-y-1.5" aria-label="Presupuesto">
          {b.pct !== null ? (
            <>
              <div className="flex justify-between text-sm"><span>Presupuesto</span><span className="tabular-nums">{formatEURExact(b.spent)} / {formatEURExact(b.budget!)}</span></div>
              <Meter pct={b.pct} status={b.status === 'over' ? 'over' : b.status === 'warn' ? 'warn' : 'ok'} label={`Presupuesto usado: ${Math.round(b.pct * 100)} %`} />
              <p className={cn('text-xs', b.status === 'over' ? 'font-medium text-danger' : 'text-muted-foreground')}>{b.status === 'over' ? `Superado en ${formatEURExact(-b.remaining!)}` : `Quedan ${formatEURExact(b.remaining!)} (${Math.round((1 - b.pct) * 100)} %)`}</p>
            </>
          ) : <p className="text-sm text-muted-foreground">{b.spent > 0 ? `${formatEURExact(b.spent)} en reservas. ` : ''}Añade un presupuesto con «Editar» para controlarlo.</p>}
        </div>
        {trip.notes && <p className="mt-3 whitespace-pre-line rounded-xl bg-muted/50 p-3 text-sm">{trip.notes}</p>}
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Segmented label="Sección del viaje" value={tab} onChange={setTab} options={[{ value: 'plan', label: 'Itinerario' }, { value: 'bookings', label: `Reservas (${trip.bookings.length})` }, { value: 'packing', label: `Maleta (${packed}/${trip.packing.length})` }]} />
        <span className="flex-1" />
        {tab === 'plan' && <Button onClick={() => setPlan({ open: true })}><Plus size={16} /> Añadir plan</Button>}
        {tab === 'bookings' && <Button onClick={() => setBooking({ open: true })}><Plus size={16} /> Nueva reserva</Button>}
      </div>

      {tab === 'plan' && (
        <ol className="space-y-3">
          {trip.plan.map((d) => (
            <li key={d.date} className="rounded-2xl border bg-card p-4">
              <div className="flex items-center gap-2">
                <h2 className="flex-1 text-sm font-semibold"><span className="text-muted-foreground">Día {d.n} · </span>{dayName(d.date)}</h2>
                <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Añadir plan al día ${d.n}`} onClick={() => setPlan({ open: true, date: d.date })}><Plus size={14} /></Button>
              </div>
              {d.items.length === 0 ? <p className="mt-1 text-xs text-muted-foreground">Sin planes</p> : (
                <ul className="mt-2 divide-y">
                  {d.items.map((i) => (
                    <li key={i.id}><button onClick={() => setPlan({ open: true, item: { id: i.id, date: d.date, time: i.time, title: i.title, notes: i.notes } })} className="flex w-full gap-3 py-2 text-left hover:text-primary">
                      <span className="w-12 shrink-0 text-xs tabular-nums text-muted-foreground">{i.time ?? 'Todo el día'}</span>
                      <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{i.title}</span>{i.notes && <span className="block text-xs text-muted-foreground">{i.notes}</span>}</span>
                    </button></li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}

      {tab === 'bookings' && (
        trip.bookings.length === 0 ? <Card className="p-6"><EmptyState icon={<Plane size={28} />} title="Sin reservas" hint="Añade vuelos, alojamiento, trenes… con su referencia y coste." /></Card> : (
          <ul className="divide-y rounded-2xl border bg-card px-4">
            {trip.bookings.map((r) => {
              const Icon = ICON[r.kind];
              return (
                <li key={r.id}><button onClick={() => setBooking({ open: true, value: r })} className="flex w-full items-start gap-3 py-3 text-left">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted"><Icon size={16} aria-hidden /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{r.title}</span>
                    <span className="block text-xs text-muted-foreground">{BOOKING_LABEL[r.kind]}{r.startsAt && ` · ${when(r.startsAt)}`}{r.endsAt && ` → ${when(r.endsAt)}`}</span>
                    {r.reference && <span className="block text-xs text-muted-foreground">Ref. <span className="font-mono">{r.reference}</span></span>}
                    {r.details && <span className="block text-xs text-muted-foreground">{r.details}</span>}
                  </span>
                  {r.cost !== null && <span className="shrink-0 text-sm font-medium tabular-nums">{formatEUR(r.cost, 2)}</span>}
                </button></li>
              );
            })}
          </ul>
        )
      )}

      {tab === 'packing' && <Packing tripId={trip.id} items={trip.packing} />}

      <TripForm open={edit} onClose={() => setEdit(false)} trip={trip} />
      <BookingForm open={booking.open} onClose={() => setBooking({ open: false })} tripId={trip.id} booking={booking.value} />
      <ItineraryForm open={plan.open} onClose={() => setPlan({ open: false })} tripId={trip.id} dayKeys={trip.dayKeys} item={plan.item} defaultDate={plan.date} />
    </div>
  );
}

function Packing({ tripId, items }: { tripId: string; items: TripDetailDTO['packing'] }) {
  const { pending, error, run } = useRun();
  const [label, setLabel] = useState('');
  return (
    <div className="space-y-3">
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!label.trim()) return; run(() => addPackingAction(tripId, { label }), () => setLabel('')); }}>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Añadir a la maleta…" maxLength={120} aria-label="Nuevo elemento de la maleta" />
        <Button type="submit" disabled={pending}><Plus size={16} /> Añadir</Button>
        <Button type="button" variant="outline" disabled={pending} onClick={() => run(() => addDefaultPackingAction(tripId))}>Añadir básicos</Button>
      </form>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {items.length === 0 ? <Card className="p-6"><EmptyState title="Maleta vacía" hint="Pulsa «Añadir básicos» para una lista de partida." /></Card> : (
        <ul className="divide-y rounded-2xl border bg-card px-4">
          {items.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-2">
              <button aria-pressed={p.packed} aria-label={`${p.packed ? 'Desmarcar' : 'Marcar'} «${p.label}»`} disabled={pending} onClick={() => run(() => setPackedAction(p.id, !p.packed))}
                className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded border-2', p.packed ? 'border-success bg-success text-white' : 'border-muted-foreground/40')}>{p.packed && <Check size={12} strokeWidth={3} />}</button>
              <span className={cn('flex-1 text-sm', p.packed && 'text-muted-foreground line-through')}>{p.label}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" disabled={pending} aria-label={`Quitar «${p.label}»`} onClick={() => run(() => deletePackingAction(p.id))}><Trash2 size={14} /></Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
