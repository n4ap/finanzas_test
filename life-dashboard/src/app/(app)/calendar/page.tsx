import { CalendarView } from '@/components/calendar/calendar-view';
import { addDaysLocal } from '@/lib/calendar';
import { db } from '@/lib/db';
import { requireUser } from '@/server/auth';

export const metadata = { title: 'Calendario' };
export const dynamic = 'force-dynamic';

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const user = await requireUser();
  const { date } = await searchParams;
  const center = date && /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(new Date(date).getTime()) ? new Date(`${date}T12:00`) : new Date();
  // Ventana precargada alrededor de la fecha; el cliente recarga si el usuario navega fuera de ella.
  const from = addDaysLocal(center, -62), to = addDaysLocal(center, 93);
  const [calendars, events] = await Promise.all([
    db.calendar.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: 'desc' }, { name: 'asc' }] }),
    db.event.findMany({ where: { calendar: { userId: user.id }, startsAt: { gte: from, lt: to } }, orderBy: { startsAt: 'asc' } }),
  ]);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <CalendarView
      calendars={calendars.map((c) => ({ id: c.id, name: c.name, color: c.color, isDefault: c.isDefault }))}
      events={events.map((e) => ({ id: e.id, calendarId: e.calendarId, title: e.title, description: e.description, location: e.location, startsAt: e.startsAt.toISOString(), endsAt: e.endsAt.toISOString(), allDay: e.allDay, attendees: e.attendees, important: e.important }))}
      window={{ from: from.toISOString(), to: to.toISOString() }}
      initialDate={`${center.getFullYear()}-${pad(center.getMonth() + 1)}-${pad(center.getDate())}`}
    />
  );
}
