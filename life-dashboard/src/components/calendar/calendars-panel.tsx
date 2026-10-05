'use client';
import { Plus, Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { Button, Input } from '@/components/ui/primitives';
import { createCalendar, deleteCalendar } from '@/server/actions/calendar';
import type { CalendarDTO } from './types';

const PALETTE = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

export function CalendarsPanel({ calendars, hidden, onToggle }: { calendars: CalendarDTO[]; hidden: Set<string>; onToggle: (id: string) => void }) {
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Calendarios</p>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setAdding((a) => !a)} aria-label="Añadir calendario"><Plus size={14} /></Button></div>
      <ul>
        {calendars.map((c) => (
          <li key={c.id} className="group flex items-center gap-2 py-1">
            <label className="flex flex-1 items-center gap-2 text-sm"><input type="checkbox" checked={!hidden.has(c.id)} onChange={() => onToggle(c.id)} style={{ accentColor: c.color }} /><span className="truncate">{c.name}</span></label>
            {!c.isDefault && <button className="opacity-0 group-hover:opacity-100 focus:opacity-100" aria-label={`Eliminar calendario ${c.name}`} disabled={pending}
              onClick={() => { if (confirm(`¿Eliminar «${c.name}» y todos sus eventos?`)) start(async () => { const r = await deleteCalendar(c.id); if (!r.ok) setError(r.error); }); }}><Trash2 size={13} className="text-muted-foreground" /></button>}
          </li>
        ))}
      </ul>
      {adding && (
        <form className="space-y-2 rounded-xl border p-2" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); start(async () => { const r = await createCalendar({ name: f.get('name'), color: f.get('color') }); if (r.ok) { setAdding(false); setError(null); } else setError(r.error); }); }}>
          <Input name="name" placeholder="Nombre" required maxLength={60} />
          <div className="flex gap-1.5">{PALETTE.map((c, i) => <label key={c} className="cursor-pointer"><input type="radio" name="color" value={c} defaultChecked={i === 0} className="peer sr-only" /><span className="block h-5 w-5 rounded-full ring-offset-2 ring-offset-card peer-checked:ring-2 peer-focus-visible:ring-2" style={{ background: c, ['--tw-ring-color' as string]: c }} /></label>)}</div>
          <Button size="sm" type="submit" disabled={pending}>Crear</Button>
        </form>
      )}
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </div>
  );
}
