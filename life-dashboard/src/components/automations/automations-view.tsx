'use client';
import { Eye, Pencil, Play, Plus, Zap } from 'lucide-react';
import { useState } from 'react';
import { ProposalCard } from '@/components/assistant/proposal-card';
import { Badge, Button, Card, EmptyState } from '@/components/ui/primitives';
import { useRun } from '@/components/ui/use-run';
import { AUTOMATION_TEMPLATES, describeAutomation } from '@/lib/automations';
import { cn } from '@/lib/utils';
import { createAutomationAction, previewAutomationAction, runAutomationsAction, setAutomationEnabledAction } from '@/server/actions/automations';
import type { RunReport } from '@/server/automations/engine';
import { AutomationForm, type AutomationDTO } from './automation-form';

type Preview = { description: string; matches: { title: string; body: string; alreadyFired: boolean }[] };
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Nunca');

export function AutomationsView({ automations, pending }: { automations: AutomationDTO[]; pending: { id: string; summary: string; source: string }[] }) {
  const { pending: busy, error, run } = useRun();
  const [form, setForm] = useState<{ open: boolean; automation?: AutomationDTO | null }>({ open: false });
  const [report, setReport] = useState<RunReport[] | null>(null);
  // Propuestas resueltas en esta sesión: siguen visibles (con su resultado) aunque el servidor ya no las liste como pendientes.
  const [kept, setKept] = useState<{ id: string; summary: string; source: string }[]>([]);
  const [preview, setPreview] = useState<{ id: string; data: Preview } | null>(null);
  const tz = () => new Date().getTimezoneOffset();
  const exec = (id: string | null) => run(() => runAutomationsAction(id, tz()), (r) => setReport(r ?? []));
  const fired = report?.reduce((a, r) => a + r.fired, 0) ?? 0;
  const proposals = report?.reduce((a, r) => a + r.proposals, 0) ?? 0;
  const errors = report?.flatMap((r) => r.errors) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold">Automatizaciones</h1>
        <Button variant="outline" disabled={busy || automations.every((a) => !a.enabled)} onClick={() => exec(null)}><Play size={16} /> Ejecutar ahora</Button>
        <Button onClick={() => setForm({ open: true })}><Plus size={16} /> Nueva</Button>
      </div>
      <p className="text-sm text-muted-foreground">Reglas «cuando pase X, entonces Y». Las que crean datos te piden confirmación por defecto. Se evalúan al pulsar «Ejecutar ahora» o por un planificador externo (ver README).</p>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {report && (
        <p role="status" className="rounded-xl bg-primary/10 px-3 py-2 text-sm text-primary">
          {fired === 0 ? 'Nada nuevo que disparar: todo lo que cumplía las reglas ya estaba avisado.' : `Se han disparado ${fired} ${fired === 1 ? 'aviso' : 'avisos'}${proposals ? `, ${proposals} ${proposals === 1 ? 'propuesta pendiente' : 'propuestas pendientes'} de tu confirmación` : ''}.`}
          {errors.length > 0 && <span className="text-danger"> Errores: {errors.join('; ')}</span>}
        </p>
      )}

      {(pending.length > 0 || kept.length > 0) && (
        <section aria-label="Pendientes de confirmar">
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pendientes de confirmar · {pending.length}</h2>
          <div className="rounded-2xl border bg-card p-3">
            {[...pending, ...kept.filter((k) => !pending.some((p) => p.id === k.id))].map((p) => (
              <ProposalCard key={p.id} p={{ id: p.id, summary: `${p.summary}${p.source === 'automation' ? ' · (automatización)' : ''}`, status: 'pending' }} onDone={() => setKept((k) => (k.some((x) => x.id === p.id) ? k : [...k, p]))} />
            ))}
          </div>
        </section>
      )}

      {automations.length === 0 ? (
        <Card className="p-6"><EmptyState icon={<Zap size={28} />} title="Aún no tienes automatizaciones" hint="Empieza con una plantilla de abajo." /></Card>
      ) : (
        <ul className="space-y-3">
          {automations.map((a) => (
            <li key={a.id} className="rounded-2xl border bg-card p-4" data-automation={a.name}>
              <div className="flex flex-wrap items-start gap-3">
                <button role="switch" aria-checked={a.enabled} aria-label={`${a.enabled ? 'Desactivar' : 'Activar'} «${a.name}»`} disabled={busy}
                  onClick={() => run(() => setAutomationEnabledAction(a.id, !a.enabled))}
                  className={cn('mt-0.5 h-6 w-10 shrink-0 rounded-full p-0.5 transition-colors', a.enabled ? 'bg-primary' : 'bg-muted-foreground/30')}>
                  <span className={cn('block h-5 w-5 rounded-full bg-white transition-transform', a.enabled && 'translate-x-4')} />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{a.name}</p>
                  <p className="text-sm text-muted-foreground">{a.description}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Última ejecución: {when(a.lastRunAt)}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => previewAutomationAction(a.id, tz()), (d) => setPreview({ id: a.id, data: d! }))} aria-label={`Probar «${a.name}» sin ejecutar`}><Eye size={14} /> Probar</Button>
                  <Button size="sm" variant="outline" disabled={busy || !a.enabled} onClick={() => exec(a.id)} aria-label={`Ejecutar «${a.name}»`}><Play size={14} /> Ejecutar</Button>
                  <Button size="sm" variant="ghost" onClick={() => setForm({ open: true, automation: a })} aria-label={`Editar «${a.name}»`}><Pencil size={14} /></Button>
                </div>
              </div>
              {preview?.id === a.id && (
                <div className="mt-3 rounded-xl bg-muted/50 p-3 text-sm" role="region" aria-label="Vista previa">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Vista previa (no se ha ejecutado nada)</p>
                  {preview.data.matches.length === 0 ? <p>Ahora mismo nada cumple la regla.</p> : (
                    <ul className="space-y-1">{preview.data.matches.map((m, i) => <li key={i} className="flex items-start gap-2"><span className="flex-1">{m.title}{m.body && <span className="text-muted-foreground"> · {m.body}</span>}</span>{m.alreadyFired && <Badge>Ya avisado</Badge>}</li>)}</ul>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <section aria-label="Plantillas">
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Plantillas</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {AUTOMATION_TEMPLATES.filter((t) => !automations.some((a) => a.name === t.name)).map((t) => (
            <li key={t.name} className="flex items-center gap-3 rounded-xl border bg-card p-3">
              <div className="min-w-0 flex-1"><p className="text-sm font-medium">{t.name}</p><p className="text-xs text-muted-foreground">{describeAutomation(t)}</p></div>
              <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => createAutomationAction(t))} aria-label={`Añadir plantilla «${t.name}»`}>Añadir</Button>
            </li>
          ))}
        </ul>
      </section>

      <AutomationForm key={form.automation?.id ?? 'new'} open={form.open} onClose={() => setForm({ open: false })} automation={form.automation} />
    </div>
  );
}
