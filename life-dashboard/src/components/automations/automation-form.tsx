'use client';
import { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button, Field, Input, Select } from '@/components/ui/primitives';
import { useRun } from '@/components/ui/use-run';
import { ACTION_LABEL, ACTION_TYPES, TRIGGER_LABEL, TRIGGER_TYPES, WEEKDAY_LABEL, type ActionType, type TriggerType } from '@/lib/automations';
import { createAutomationAction, deleteAutomationAction, updateAutomationAction } from '@/server/actions/automations';

export interface AutomationDTO {
  id: string; name: string; triggerType: string; triggerConfig: Record<string, number>; actionType: string; actionConfig: Record<string, string>;
  requiresConfirmation: boolean; enabled: boolean; lastRunAt: string | null; description: string;
}

export function AutomationForm({ open, onClose, automation }: { open: boolean; onClose: () => void; automation?: AutomationDTO | null }) {
  const { pending, error, run } = useRun();
  const [trigger, setTrigger] = useState<string>(automation?.triggerType ?? 'task_overdue');
  const [action, setAction] = useState<string>(automation?.actionType ?? 'notify');
  const [confirm, setConfirm] = useState(automation?.requiresConfirmation ?? true);
  const editing = !!automation;
  const tc = automation?.triggerConfig ?? {};
  // «digest» solo existe con el disparador semanal.
  const actions = ACTION_TYPES.filter((a) => a !== 'digest' || trigger === 'weekly');
  const effectiveAction = actions.includes(action as ActionType) ? action : 'notify';
  return (
    <Dialog open={open} onClose={onClose} title={editing ? 'Editar automatización' : 'Nueva automatización'}>
      <form key={automation?.id ?? 'new'} className="space-y-3" onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const triggerConfig: Record<string, unknown> = {};
        for (const k of ['threshold', 'days', 'weekday']) if (f.get(k)) triggerConfig[k] = f.get(k);
        const payload = {
          name: f.get('name'), triggerType: trigger, triggerConfig, actionType: effectiveAction,
          actionConfig: effectiveAction === 'create_task' ? { titleTemplate: f.get('titleTemplate') } : {}, requiresConfirmation: effectiveAction === 'create_task' ? confirm : true, enabled: automation?.enabled ?? true,
        };
        run(() => (editing ? updateAutomationAction(automation!.id, payload) : createAutomationAction(payload)), () => onClose());
      }}>
        <Field label="Nombre"><Input name="name" required maxLength={80} defaultValue={automation?.name} autoFocus /></Field>
        <Field label="Cuando…">
          <Select value={trigger} onChange={(e) => setTrigger(e.target.value)} aria-label="Disparador">{TRIGGER_TYPES.map((t) => <option key={t} value={t}>{TRIGGER_LABEL[t as TriggerType]}</option>)}</Select>
        </Field>
        {trigger === 'budget_alert' && <Field label="Umbral del presupuesto"><Select name="threshold" defaultValue={tc.threshold ?? 100}><option value={80}>Al llegar al 80 %</option><option value={100}>Al superar el 100 %</option></Select></Field>}
        {['birthday_soon', 'email_needs_reply', 'trip_soon'].includes(trigger) && <Field label="Con una antelación de (días)"><Input name="days" type="number" min={1} max={30} defaultValue={tc.days ?? (trigger === 'email_needs_reply' ? 2 : 7)} /></Field>}
        {trigger === 'weekly' && <Field label="Día de la semana"><Select name="weekday" defaultValue={tc.weekday ?? 1}>{[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{WEEKDAY_LABEL[n]}</option>)}</Select></Field>}
        <Field label="Entonces…">
          <Select value={effectiveAction} onChange={(e) => setAction(e.target.value)} aria-label="Acción">{actions.map((a) => <option key={a} value={a}>{ACTION_LABEL[a]}</option>)}</Select>
        </Field>
        {effectiveAction === 'create_task' && (
          <>
            <Field label="Título de la tarea"><Input name="titleTemplate" required maxLength={150} defaultValue={automation?.actionConfig.titleTemplate ?? 'Revisar: {subject}'} /></Field>
            <p className="-mt-1 text-xs text-muted-foreground">{'{subject}'} se sustituye por la tarea, persona, email… que dispara la regla.</p>
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} /> <span>Pedirme confirmación antes de crear la tarea <span className="text-muted-foreground">(recomendado)</span></span></label>
            {!confirm && <p role="note" className="rounded-xl bg-warning/10 px-3 py-2 text-xs text-warning">Sin confirmación, la tarea se creará sola cada vez que la regla se dispare.</p>}
          </>
        )}
        <p className="text-xs text-muted-foreground">Las reglas se evalúan al pulsar «Ejecutar» o cuando un planificador externo lo pide. Cada coincidencia se dispara una sola vez.</p>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-between pt-2">
          {editing ? <Button type="button" variant="ghost" className="text-danger" disabled={pending} onClick={() => { if (confirm_('¿Eliminar esta automatización?')) run(() => deleteAutomationAction(automation!.id), () => onClose()); }}>Eliminar</Button> : <span />}
          <div className="flex gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Guardar'}</Button></div>
        </div>
      </form>
    </Dialog>
  );
}
const confirm_ = (m: string) => window.confirm(m);
