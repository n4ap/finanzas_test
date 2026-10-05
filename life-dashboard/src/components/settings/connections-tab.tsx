'use client';
import { CalendarDays, Newspaper, RefreshCw, Trash2, Mail, Lock } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, Card, Field, Input, Select } from '@/components/ui/primitives';
import { useRun } from '@/components/ui/use-run';
import { NEWS_CATEGORIES } from '@/lib/news';
import { addCalendarAction, addFeedAction, removeConnectionAction, syncConnectionAction } from '@/server/actions/settings';
import type { SettingsData } from '@/server/settings/queries';

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Nunca');
const PLANNED = [
  { icon: Mail, name: 'Gmail y Outlook (correo)' }, { icon: CalendarDays, name: 'Google Calendar y Outlook (calendario, con edición)' }, { icon: Lock, name: 'Bancos y brokers' },
];

export function ConnectionsTab({ connections }: { connections: SettingsData['connections'] }) {
  const { pending, error, run } = useRun();
  const [msg, setMsg] = useState<string | null>(null);
  const note = (m: string) => setMsg(m);
  return (
    <div className="space-y-4">
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {msg && <p role="status" className="rounded-xl bg-primary/10 px-3 py-2 text-sm text-primary">{msg}</p>}

      <Card className="p-5">
        <h2 className="mb-1 font-semibold">Conexiones activas</h2>
        {connections.length === 0 ? <p className="text-sm text-muted-foreground">Aún no has conectado nada. Añade un calendario iCal o un feed de noticias abajo.</p> : (
          <ul className="divide-y">
            {connections.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 py-3" data-connection={c.label}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">{c.kind === 'calendar' ? <CalendarDays size={16} aria-hidden /> : <Newspaper size={16} aria-hidden />}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.label}</p>
                  <p className="text-xs text-muted-foreground">{c.kind === 'calendar' ? 'Calendario iCal (solo lectura)' : 'Feed de noticias'} · última sincronización: {when(c.lastSyncAt)}</p>
                  {c.status === 'error' && <p role="alert" className="text-xs text-danger">Error: {c.lastError}</p>}
                </div>
                <Badge tone={c.status === 'connected' ? 'success' : 'urgent'}>{c.status === 'connected' ? 'Conectado' : 'Con error'}</Badge>
                <Button size="sm" variant="outline" disabled={pending} aria-label={`Sincronizar «${c.label}»`} onClick={() => run(() => syncConnectionAction(c.id, c.kind), (n) => note(`«${c.label}» sincronizado (${n ?? 0} ${c.kind === 'calendar' ? 'eventos' : 'noticias nuevas'}).`))}><RefreshCw size={14} /> Sincronizar</Button>
                <Button size="sm" variant="ghost" className="text-danger" disabled={pending} aria-label={`Desconectar «${c.label}»`} onClick={() => { if (confirm(`¿Desconectar «${c.label}»? Se borrará ${c.kind === 'calendar' ? 'el calendario con sus eventos importados' : 'lo importado de este feed'}.`)) run(() => removeConnectionAction(c.id), () => note(`«${c.label}» desconectado.`)); }}><Trash2 size={14} /></Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="mb-1 flex items-center gap-2 font-semibold"><CalendarDays size={16} aria-hidden /> Suscribirse a un calendario (iCal)</h2>
        <p className="mb-3 text-xs text-muted-foreground">Pega la dirección «.ics» o «webcal://» que ofrece Google Calendar, Outlook, Apple o tu empresa («dirección secreta en formato iCal»). Se importa en modo lectura y se actualiza al sincronizar. La dirección se guarda cifrada.</p>
        <form className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]" onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget; const f = new FormData(form);
          run(() => addCalendarAction({ name: f.get('name'), url: f.get('url') }), (r) => { form.reset(); note(`Calendario suscrito (${(r as { events: number } | undefined)?.events ?? 0} eventos).`); });
        }}>
          <Field label="Nombre"><Input name="name" required maxLength={60} placeholder="Trabajo" /></Field>
          <Field label="Dirección iCal"><Input name="url" required type="url" inputMode="url" placeholder="https://…/basic.ics" autoComplete="off" /></Field>
          <Button type="submit" className="self-end" disabled={pending}>{pending ? 'Conectando…' : 'Suscribir'}</Button>
        </form>
      </Card>

      <Card className="p-5">
        <h2 className="mb-1 flex items-center gap-2 font-semibold"><Newspaper size={16} aria-hidden /> Seguir un feed de noticias (RSS / Atom)</h2>
        <p className="mb-3 text-xs text-muted-foreground">Cualquier medio o blog con feed RSS/Atom. El contenido se limpia de HTML y solo se guardan enlaces http(s).</p>
        <form className="grid gap-3 sm:grid-cols-[2fr_1fr_auto]" onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget; const f = new FormData(form);
          run(() => addFeedAction({ url: f.get('url'), category: f.get('category'), name: f.get('name') || undefined }), (r) => { form.reset(); note(`Feed añadido (${(r as { articles: number } | undefined)?.articles ?? 0} noticias).`); });
        }}>
          <Field label="Dirección del feed"><Input name="url" required type="url" inputMode="url" placeholder="https://…/rss.xml" autoComplete="off" /></Field>
          <Field label="Categoría"><Select name="category" defaultValue="tecnologia">{NEWS_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select></Field>
          <Button type="submit" className="self-end" disabled={pending}>{pending ? 'Añadiendo…' : 'Añadir'}</Button>
        </form>
      </Card>

      <Card className="p-5">
        <h2 className="mb-1 font-semibold">Todavía no disponibles</h2>
        <p className="mb-2 text-xs text-muted-foreground">Requieren registrar la aplicación en Google/Microsoft (credenciales OAuth propias) o un acuerdo con el banco; la arquitectura de adaptadores ya está preparada, pero no se han implementado.</p>
        <ul className="space-y-1.5">{PLANNED.map((p) => <li key={p.name} className="flex items-center gap-2 text-sm text-muted-foreground"><p.icon size={14} aria-hidden /> {p.name} <Badge>Pendiente</Badge></li>)}</ul>
      </Card>
    </div>
  );
}
