'use client';
import { Bot, Pencil, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Badge, Button, Card, EmptyState, Field, Input, Select, Textarea } from '@/components/ui/primitives';
import { useRun } from '@/components/ui/use-run';
import { createDecisionAction, deleteDecisionAction, updateDecisionAction } from '@/server/actions/coach';
import type { CoachData } from '@/server/coach/queries';

type DecisionDTO = CoachData['decisions'][number];
type Opt = { name: string; pros: string; cons: string; risks: string; cost: string };
const blank = (): Opt => ({ name: '', pros: '', cons: '', risks: '', cost: '' });

export function DecisionsTab({ d }: { d: CoachData }) {
  const [form, setForm] = useState<{ open: boolean; decision?: DecisionDTO | null }>({ open: false });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sm text-muted-foreground">Para decisiones importantes: escribe las opciones con sus ventajas, desventajas, riesgos y coste (tiempo, dinero, energía y oportunidad). Luego pide al asistente su análisis.</p>
        <Button onClick={() => setForm({ open: true })}><Plus size={16} aria-hidden /> Nueva decisión</Button>
      </div>
      {d.decisions.length === 0 ? <EmptyState title="Sin decisiones registradas" hint="Cuando tengas una decisión importante (trabajo, inversión, mudanza…), estructúrala aquí." /> : (
        <div className="grid gap-4 lg:grid-cols-2">{d.decisions.map((x) => <DecisionCard key={x.id} x={x} onEdit={() => setForm({ open: true, decision: x })} />)}</div>
      )}
      <DecisionForm key={form.decision?.id ?? 'new'} open={form.open} decision={form.decision} onClose={() => setForm({ open: false })} />
    </div>
  );
}

function DecisionCard({ x, onEdit }: { x: DecisionDTO; onEdit: () => void }) {
  const ask = `Analiza mi decisión «${x.title.slice(0, 120)}» con el formato de decisiones`;
  return (
    <Card className="p-4">
      <div className="flex items-start gap-2">
        <h3 className="mr-auto font-semibold">{x.title}</h3>
        <Badge tone={x.status === 'decided' ? 'success' : 'important'}>{x.status === 'decided' ? 'Decidida' : 'Abierta'}</Badge>
        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Editar «${x.title}»`} onClick={onEdit}><Pencil size={14} /></Button>
      </div>
      <dl className="mt-2 space-y-2 text-sm">
        {x.objective && <div><dt className="text-xs font-semibold uppercase text-muted-foreground">Objetivo</dt><dd>{x.objective}</dd></div>}
        <div>
          <dt className="text-xs font-semibold uppercase text-muted-foreground">Opciones</dt>
          <dd className="mt-1 space-y-2">
            {x.options.map((o) => (
              <div key={o.name} className="rounded-lg border p-2">
                <p className="font-medium">{o.name}{x.chosen === o.name && <Badge tone="success" className="ml-2">Elegida</Badge>}</p>
                <ul className="mt-1 space-y-0.5 text-xs">
                  {o.pros && <li><strong>Ventajas:</strong> {o.pros}</li>}
                  {o.cons && <li><strong>Desventajas:</strong> {o.cons}</li>}
                  {o.risks && <li><strong>Riesgos:</strong> {o.risks}</li>}
                  {o.cost && <li><strong>Coste:</strong> {o.cost}</li>}
                </ul>
              </div>
            ))}
          </dd>
        </div>
        {x.impact && <div><dt className="text-xs font-semibold uppercase text-muted-foreground">Impacto</dt><dd className="whitespace-pre-line">{x.impact}</dd></div>}
        {x.recommendation && <div><dt className="text-xs font-semibold uppercase text-muted-foreground">Recomendación</dt><dd className="whitespace-pre-line">{x.recommendation}</dd></div>}
        {x.nextAction && <div><dt className="text-xs font-semibold uppercase text-muted-foreground">Próxima acción</dt><dd>{x.nextAction}</dd></div>}
      </dl>
      <Link href={`/assistant?q=${encodeURIComponent(ask)}`} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"><Bot size={14} aria-hidden /> Pedir análisis al asistente</Link>
    </Card>
  );
}

function DecisionForm({ open, decision, onClose }: { open: boolean; decision?: DecisionDTO | null; onClose: () => void }) {
  const { pending, error, run } = useRun();
  const editing = !!decision;
  const [opts, setOpts] = useState<Opt[]>(() => decision?.options.map((o) => ({ name: o.name, pros: o.pros ?? '', cons: o.cons ?? '', risks: o.risks ?? '', cost: o.cost ?? '' })) ?? [blank(), blank()]);
  const set = (i: number, k: keyof Opt, v: string) => setOpts(opts.map((o, j) => (j === i ? { ...o, [k]: v } : o)));
  return (
    <Dialog open={open} onClose={onClose} title={editing ? 'Editar decisión' : 'Nueva decisión'} wide>
      <form className="space-y-3" onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const v = (k: string) => String(f.get(k) ?? '');
        const payload = { title: v('title'), objective: v('objective'), options: opts.filter((o) => o.name.trim()), impact: v('impact'), recommendation: v('recommendation'), nextAction: v('nextAction'), status: v('status') || 'open', chosen: v('chosen') };
        run(() => (editing ? updateDecisionAction(decision!.id, payload) : createDecisionAction(payload)), () => onClose());
      }}>
        <Field label="Decisión"><Input name="title" required minLength={3} maxLength={160} defaultValue={decision?.title} autoFocus placeholder="¿Cambio de trabajo a la empresa X?" /></Field>
        <Field label="Objetivo: ¿qué quieres conseguir?"><Textarea name="objective" rows={2} maxLength={500} defaultValue={decision?.objective ?? ''} /></Field>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Opciones</legend>
          {opts.map((o, i) => (
            <div key={i} className="space-y-2 rounded-xl border p-3">
              <div className="flex gap-2">
                <Input aria-label={`Opción ${i + 1}`} value={o.name} onChange={(e) => set(i, 'name', e.target.value)} maxLength={120} placeholder={`Opción ${i + 1}`} />
                {opts.length > 1 && <Button type="button" variant="ghost" size="icon" aria-label={`Quitar opción ${i + 1}`} onClick={() => setOpts(opts.filter((_, j) => j !== i))}><Trash2 size={14} /></Button>}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Textarea aria-label={`Ventajas de la opción ${i + 1}`} rows={2} maxLength={800} value={o.pros} onChange={(e) => set(i, 'pros', e.target.value)} placeholder="Ventajas: ¿qué ganas?" />
                <Textarea aria-label={`Desventajas de la opción ${i + 1}`} rows={2} maxLength={800} value={o.cons} onChange={(e) => set(i, 'cons', e.target.value)} placeholder="Desventajas: ¿qué pierdes?" />
                <Textarea aria-label={`Riesgos de la opción ${i + 1}`} rows={2} maxLength={800} value={o.risks} onChange={(e) => set(i, 'risks', e.target.value)} placeholder="Riesgos: ¿qué puede salir mal?" />
                <Textarea aria-label={`Coste de la opción ${i + 1}`} rows={2} maxLength={400} value={o.cost} onChange={(e) => set(i, 'cost', e.target.value)} placeholder="Coste: tiempo + dinero + energía + oportunidad" />
              </div>
            </div>
          ))}
          {opts.length < 6 && <Button type="button" variant="outline" size="sm" onClick={() => setOpts([...opts, blank()])}><Plus size={14} aria-hidden /> Añadir opción</Button>}
        </fieldset>
        <Field label="Impacto (corto, medio y largo plazo)"><Textarea name="impact" rows={2} maxLength={800} defaultValue={decision?.impact ?? ''} /></Field>
        <Field label="Recomendación (puedes pegar la del asistente)"><Textarea name="recommendation" rows={3} maxLength={1500} defaultValue={decision?.recommendation ?? ''} /></Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Próxima acción" className="sm:col-span-3"><Input name="nextAction" maxLength={200} defaultValue={decision?.nextAction ?? ''} /></Field>
          <Field label="Estado"><Select name="status" defaultValue={decision?.status ?? 'open'}><option value="open">Abierta</option><option value="decided">Decidida</option></Select></Field>
          <Field label="Opción elegida" className="sm:col-span-2"><Select name="chosen" defaultValue={decision?.chosen ?? ''}><option value="">— Ninguna aún —</option>{opts.filter((o) => o.name.trim()).map((o) => <option key={o.name} value={o.name}>{o.name}</option>)}</Select></Field>
        </div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-between gap-2 pt-1">
          {editing ? <Button type="button" variant="ghost" className="text-danger" disabled={pending} onClick={() => { if (confirm(`¿Borrar «${decision!.title}»?`)) run(() => deleteDecisionAction(decision!.id), () => onClose()); }}>Borrar</Button> : <span />}
          <div className="flex gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={pending}>Guardar</Button></div>
        </div>
      </form>
    </Dialog>
  );
}
