'use client';
import { ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, Card, Field, Input, Select } from '@/components/ui/primitives';
import { useRun } from '@/components/ui/use-run';
import { removeAiKeyAction, saveAiSettingsAction } from '@/server/actions/settings';
import type { SettingsData } from '@/server/settings/queries';

const MODELS = [{ id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (el más capaz, recomendado)' }, { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (más económico)' }];

export function AiTab({ ai }: { ai: SettingsData['ai'] }) {
  const { pending, error, run } = useRun();
  const [provider, setProvider] = useState<'local' | 'anthropic'>(ai.provider);
  const [saved, setSaved] = useState<string | null>(null);
  return (
    <Card className="p-5">
      <form className="space-y-4" onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const key = String(f.get('apiKey') ?? '').trim();
        run(() => saveAiSettingsAction({ provider, apiKey: key || undefined, model: f.get('model') ?? undefined, consent: f.get('consent') === 'on' }), () => { setSaved(provider === 'anthropic' ? 'Claude activado.' : 'Asistente local activado.'); (e.target as HTMLFormElement).reset(); });
      }}>
        <fieldset className="space-y-2">
          <legend className="mb-1 font-semibold">Motor del asistente</legend>
          <label className="flex items-start gap-3 rounded-xl border p-3 text-sm"><input type="radio" name="provider" className="mt-1" checked={provider === 'local'} onChange={() => setProvider('local')} />
            <span><span className="font-medium">Asistente local</span> <Badge tone="success">Privado</Badge><br /><span className="text-muted-foreground">Reglas deterministas en tu servidor. Entiende frases sencillas; tus datos no salen de la aplicación.</span></span></label>
          <label className="flex items-start gap-3 rounded-xl border p-3 text-sm"><input type="radio" name="provider" className="mt-1" checked={provider === 'anthropic'} onChange={() => setProvider('anthropic')} />
            <span><span className="font-medium">Claude (Anthropic)</span><br /><span className="text-muted-foreground">Un modelo de lenguaje: entiende peticiones libres y razona mejor. Necesitas tu propia clave de API (se cobra en tu cuenta de Anthropic).</span></span></label>
        </fieldset>

        {provider === 'anthropic' && (
          <div className="space-y-3 rounded-xl bg-muted/40 p-4">
            <Field label={ai.hasKey ? `Clave de API (guardada ${ai.keyHint}; déjalo vacío para conservarla)` : 'Clave de API de Anthropic'}>
              <Input name="apiKey" type="password" autoComplete="off" spellCheck={false} placeholder="sk-ant-…" />
            </Field>
            <Field label="Modelo"><Select name="model" defaultValue={ai.model}>{MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</Select></Field>
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="consent" className="mt-1" defaultChecked={!!ai.consentAt} />
              <span><ShieldAlert size={14} className="mr-1 inline text-warning" aria-hidden /><strong>Entiendo que mis datos se envían a Anthropic.</strong> Para responder, el asistente consulta tus tareas, agenda, finanzas, salud, etc. y <em>esa información se envía a Anthropic</em> junto con tus mensajes. La clave se guarda cifrada en tu servidor.</span></label>
          </div>
        )}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        {saved && <p role="status" className="text-sm text-success">{saved}</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>{pending ? 'Comprobando…' : 'Guardar'}</Button>
          {ai.hasKey && <Button type="button" variant="outline" className="text-danger" disabled={pending} onClick={() => { if (confirm('¿Borrar la clave guardada y volver al asistente local?')) run(() => removeAiKeyAction(), () => setSaved('Clave borrada.')); }}>Borrar clave</Button>}
        </div>
        <p className="text-xs text-muted-foreground">Sea cual sea el motor, las acciones que crean o cambian datos siempre se proponen y requieren tu confirmación.</p>
      </form>
    </Card>
  );
}
