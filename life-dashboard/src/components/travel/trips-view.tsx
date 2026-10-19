'use client';
import { CalendarDays, Plane, Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Meter } from '@/components/charts/bars';
import { Badge, Button, Card, EmptyState } from '@/components/ui/primitives';
import { PHASE_LABEL } from '@/lib/travel';
import { formatEURExact } from '@/lib/utils';
import type { TripCardDTO } from '@/server/life/queries';
import { TripForm } from './forms';

export const fmtRange = (a: string, b: string) => {
  const f = (s: string, y: boolean) => new Date(`${s}T12:00:00Z`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', ...(y ? { year: 'numeric' } : {}), timeZone: 'UTC' }).replace(/\./g, '');
  return a === b ? f(a, true) : `${f(a, false)} – ${f(b, true)}`;
};
export const countdown = (phase: string, days: number) => (phase === 'ongoing' ? 'En curso' : phase === 'past' ? 'Finalizado' : days === 0 ? 'Sale hoy' : days === 1 ? 'Sale mañana' : `Faltan ${days} días`);

function TripCard({ t }: { t: TripCardDTO }) {
  const b = t.budget;
  return (
    <li>
      <Link href={`/travel/${t.id}`} className="block h-full rounded-2xl border bg-card p-4 transition-colors hover:bg-muted/40">
        <div className="flex items-start gap-2">
          <h3 className="min-w-0 flex-1 font-semibold">{t.name}</h3>
          <Badge tone={t.phase === 'ongoing' ? 'success' : t.phase === 'upcoming' ? 'primary' : 'neutral'}>{PHASE_LABEL[t.phase]}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{t.destination}</p>
        <p className="mt-2 flex items-center gap-1.5 text-sm"><CalendarDays size={14} aria-hidden className="shrink-0 text-muted-foreground" />{fmtRange(t.startDate, t.endDate)}</p>
        <p className="mt-1 text-sm font-medium">{countdown(t.phase, t.daysUntil)}</p>
        <div className="mt-3 space-y-1">
          {b.pct !== null ? (
            <>
              <Meter pct={b.pct} status={b.status === 'over' ? 'over' : b.status === 'warn' ? 'warn' : 'ok'} label={`Presupuesto de ${t.name}: ${Math.round(b.pct * 100)} %`} />
              <p className="text-xs text-muted-foreground">{formatEURExact(b.spent)} de {formatEURExact(b.budget!)} · {b.status === 'over' ? `superado en ${formatEURExact(-b.remaining!)}` : `quedan ${formatEURExact(b.remaining!)}`}</p>
            </>
          ) : <p className="text-xs text-muted-foreground">{b.spent > 0 ? `${formatEURExact(b.spent)} en reservas · sin presupuesto` : 'Sin presupuesto'}</p>}
          <p className="text-xs text-muted-foreground">{t.bookings} {t.bookings === 1 ? 'reserva' : 'reservas'}</p>
        </div>
      </Link>
    </li>
  );
}

export function TripsView({ trips }: { trips: TripCardDTO[] }) {
  const [form, setForm] = useState(false);
  const current = trips.filter((t) => t.phase !== 'past');
  const past = trips.filter((t) => t.phase === 'past').reverse();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold">Viajes</h1>
        <Button onClick={() => setForm(true)}><Plus size={16} /> Nuevo viaje</Button>
      </div>
      {trips.length === 0 ? (
        <Card className="p-6"><EmptyState icon={<Plane size={28} />} title="Aún no tienes viajes" hint="Crea uno para organizar reservas, itinerario, presupuesto y maleta." /></Card>
      ) : (
        <>
          <section aria-label="Próximos viajes">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Próximos y en curso · {current.length}</h2>
            {current.length === 0 ? <p className="text-sm text-muted-foreground">No tienes viajes próximos.</p> : <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{current.map((t) => <TripCard key={t.id} t={t} />)}</ul>}
          </section>
          {past.length > 0 && (
            <section aria-label="Viajes pasados">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pasados · {past.length}</h2>
              <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{past.map((t) => <TripCard key={t.id} t={t} />)}</ul>
            </section>
          )}
        </>
      )}
      <TripForm open={form} onClose={() => setForm(false)} />
    </div>
  );
}
