'use client';
import { Cake, Check, ClipboardPaste, Plus, ShoppingBasket, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Badge, Button, Card, EmptyState, Field, Input, Select, Textarea } from '@/components/ui/primitives';
import { useRun } from '@/components/ui/use-run';
import { FAMILY_COLORS, RELATIONS, birthdayLabel } from '@/lib/family';
import { cn } from '@/lib/utils';
import { addShoppingAction, clearDoneShoppingAction, createMemberAction, deleteMemberAction, deleteShoppingAction, importShoppingAction, setShoppingDoneAction, updateMemberAction } from '@/server/actions/family';
import type { FamilyData } from '@/server/life/queries';

type Member = FamilyData['members'][number];
const fmt = (iso: string, withYear = false) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC' });

function MemberForm({ open, onClose, member }: { open: boolean; onClose: () => void; member?: Member | null }) {
  const { pending, error, run } = useRun();
  const editing = !!member;
  return (
    <Dialog open={open} onClose={onClose} title={editing ? 'Editar persona' : 'Nueva persona'}>
      <form key={member?.id ?? 'new'} className="space-y-3" onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const payload = { name: f.get('name'), relation: f.get('relation'), birthday: f.get('birthday'), color: f.get('color'), notes: f.get('notes') };
        run(() => (editing ? updateMemberAction(member!.id, payload) : createMemberAction(payload)), () => onClose());
      }}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nombre"><Input name="name" required maxLength={80} defaultValue={member?.name} autoFocus /></Field>
          <Field label="Relación"><Input name="relation" required maxLength={40} list="relations" defaultValue={member?.relation} /><datalist id="relations">{RELATIONS.map((r) => <option key={r} value={r} />)}</datalist></Field>
          <Field label="Cumpleaños"><Input name="birthday" type="date" defaultValue={member?.birthday ?? ''} max={new Date().toISOString().slice(0, 10)} /></Field>
          <Field label="Color"><Select name="color" defaultValue={member?.color ?? FAMILY_COLORS[1]}>{FAMILY_COLORS.map((c, i) => <option key={c} value={c}>Color {i + 1}</option>)}</Select></Field>
        </div>
        <Field label="Notas (ideas de regalo, alergias…)"><Textarea name="notes" maxLength={1000} defaultValue={member?.notes ?? ''} /></Field>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-between pt-2">
          {editing ? <Button type="button" variant="ghost" className="text-danger" disabled={pending} onClick={() => { if (confirm(`¿Eliminar a ${member!.name}?`)) run(() => deleteMemberAction(member!.id), () => onClose()); }}>Eliminar</Button> : <span />}
          <div className="flex gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={pending}>Guardar</Button></div>
        </div>
      </form>
    </Dialog>
  );
}

export function FamilyView({ d }: { d: FamilyData }) {
  const [form, setForm] = useState<{ open: boolean; member?: Member | null }>({ open: false });
  const upcoming = d.members.filter((m) => m.next && m.next.daysUntil <= 60);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold">Familia</h1>
        <Button onClick={() => setForm({ open: true })}><Plus size={16} /> Nueva persona</Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="p-4">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Cake size={16} aria-hidden /> Próximos cumpleaños</h2>
            {upcoming.length === 0 ? <p className="text-sm text-muted-foreground">Ninguno en los próximos 60 días.</p> : (
              <ul className="divide-y">
                {upcoming.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 py-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: m.color }} aria-hidden />
                    <span className="min-w-0 flex-1 text-sm"><span className="font-medium">{m.name}</span> <span className="text-muted-foreground">cumple {m.next!.turning} · {fmt(m.next!.date)}</span></span>
                    <Badge tone={m.next!.daysUntil <= 7 ? 'important' : 'neutral'}>{birthdayLabel(m.next!.daysUntil)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {d.members.length === 0 ? (
            <Card className="p-6"><EmptyState icon={<Users size={28} />} title="Aún no has añadido a nadie" hint="Guarda a tu familia y amigos cercanos con su cumpleaños y notas." /></Card>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {d.members.map((m) => (
                <li key={m.id}>
                  <button onClick={() => setForm({ open: true, member: m })} className="block h-full w-full rounded-2xl border bg-card p-4 text-left transition-colors hover:bg-muted/40" aria-label={`Editar a ${m.name}`}>
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white" style={{ background: m.color }} aria-hidden>{m.name.slice(0, 1).toUpperCase()}</span>
                      <div className="min-w-0"><p className="truncate font-medium">{m.name}</p><p className="text-xs text-muted-foreground">{m.relation}{m.birthday && ` · ${fmt(m.birthday, true)}`}</p></div>
                    </div>
                    {m.notes && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{m.notes}</p>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Shopping items={d.shopping} />
      </div>
      <MemberForm open={form.open} onClose={() => setForm({ open: false })} member={form.member} />
    </div>
  );
}

function Shopping({ items }: { items: FamilyData['shopping'] }) {
  const { pending, error, run } = useRun();
  const [label, setLabel] = useState('');
  const [paste, setPaste] = useState<{ open: boolean; text: string; note: string | null }>({ open: false, text: '', note: null });
  const done = items.filter((i) => i.done).length;
  return (
    <Card className="h-fit p-4">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold"><ShoppingBasket size={16} aria-hidden /> Lista de la compra<Button variant="ghost" size="sm" className="ml-auto h-7 gap-1 px-2 text-xs" onClick={() => setPaste({ open: true, text: '', note: null })}><ClipboardPaste size={14} aria-hidden /> Pegar lista</Button></h2>
      <form className="mb-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!label.trim()) return; run(() => addShoppingAction({ label }), () => setLabel('')); }}>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Añadir…" maxLength={120} aria-label="Nuevo artículo" />
        <Button type="submit" size="icon" disabled={pending} aria-label="Añadir artículo"><Plus size={16} /></Button>
      </form>
      {error && <p role="alert" className="mb-2 text-sm text-danger">{error}</p>}
      <Dialog open={paste.open} onClose={() => setPaste((p) => ({ ...p, open: false }))} title="Pegar lista de la compra">
        <form className="space-y-3" onSubmit={(e) => {
          e.preventDefault();
          run(() => importShoppingAction(paste.text), (r) => {
            if (!r) return;
            const extra = [r.duplicates ? `${r.duplicates} ya estaban` : '', r.overLimit ? `${r.overLimit} no caben (lista llena)` : ''].filter(Boolean).join(' · ');
            setPaste({ open: true, text: '', note: `${r.added} ${r.added === 1 ? 'artículo añadido' : 'artículos añadidos'}${extra ? ` · ${extra}` : ''}` });
          });
        }}>
          <p className="text-xs text-muted-foreground">Pega un artículo por línea: copia tu lista de Alexa (o de Notas, Keep, WhatsApp…) y pégala aquí. Los repetidos se saltan.</p>
          <Textarea value={paste.text} onChange={(e) => setPaste((p) => ({ ...p, text: e.target.value, note: null }))} rows={8} aria-label="Artículos, uno por línea" placeholder={'Leche\nPan\nHuevos'} />
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          {paste.note && <p role="status" className="text-sm text-muted-foreground">{paste.note}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setPaste((p) => ({ ...p, open: false }))}>Cerrar</Button><Button type="submit" disabled={pending || !paste.text.trim()}>Añadir a la lista</Button></div>
        </form>
      </Dialog>
      {items.length === 0 ? <p className="text-sm text-muted-foreground">Lista vacía.</p> : (
        <>
          <ul className="divide-y">
            {items.map((i) => (
              <li key={i.id} className="flex items-center gap-2.5 py-1.5">
                <button aria-pressed={i.done} aria-label={`${i.done ? 'Desmarcar' : 'Marcar'} «${i.label}»`} disabled={pending} onClick={() => run(() => setShoppingDoneAction(i.id, !i.done))}
                  className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded border-2', i.done ? 'border-success bg-success text-white' : 'border-muted-foreground/40')}>{i.done && <Check size={12} strokeWidth={3} />}</button>
                <span className={cn('flex-1 text-sm', i.done && 'text-muted-foreground line-through')}>{i.label}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" disabled={pending} aria-label={`Quitar «${i.label}»`} onClick={() => run(() => deleteShoppingAction(i.id))}><Trash2 size={14} /></Button>
              </li>
            ))}
          </ul>
          {done > 0 && <Button variant="outline" size="sm" className="mt-3 w-full" disabled={pending} onClick={() => run(() => clearDoneShoppingAction())}>Quitar {done} {done === 1 ? 'comprado' : 'comprados'}</Button>}
        </>
      )}
    </Card>
  );
}
