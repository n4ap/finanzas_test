'use client';
import { useState } from 'react';
import { Button, Card, Field, Input } from '@/components/ui/primitives';
import { useRun } from '@/components/ui/use-run';
import { NEWS_CATEGORIES } from '@/lib/news';
import { updateProfileAction } from '@/server/actions/settings';
import type { SettingsData } from '@/server/settings/queries';

export function ProfileTab({ profile }: { profile: SettingsData['profile'] }) {
  const { pending, error, run } = useRun();
  const [saved, setSaved] = useState(false);
  const [tz, setTz] = useState(profile.timezone);
  const zones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
  return (
    <Card className="p-5">
      <form className="space-y-4" onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        run(() => updateProfileAction({ name: f.get('name'), city: f.get('city'), timezone: tz, followedNews: f.getAll('news') }), () => setSaved(true));
      }}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre"><Input name="name" required maxLength={80} defaultValue={profile.name} onChange={() => setSaved(false)} /></Field>
          <Field label="Email"><Input value={profile.email} readOnly aria-readonly className="text-muted-foreground" /></Field>
          <Field label="Ciudad (para el tiempo)"><Input name="city" required maxLength={80} defaultValue={profile.city} onChange={() => setSaved(false)} /></Field>
          <Field label="Zona horaria">
            <div className="flex gap-2">
              <Input list="zones" value={tz} onChange={(e) => { setTz(e.target.value); setSaved(false); }} aria-label="Zona horaria" />
              <datalist id="zones">{zones.map((z) => <option key={z} value={z} />)}</datalist>
              <Button type="button" variant="outline" size="sm" className="h-10 shrink-0" onClick={() => { setTz(Intl.DateTimeFormat().resolvedOptions().timeZone); setSaved(false); }}>Detectar</Button>
            </div>
          </Field>
        </div>
        <fieldset>
          <legend className="mb-1 text-xs font-medium text-muted-foreground">Noticias que quiero priorizar</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {NEWS_CATEGORIES.map((c) => <label key={c.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="news" value={c.id} defaultChecked={profile.followedNews.includes(c.id)} onChange={() => setSaved(false)} /> {c.label}</label>)}
          </div>
        </fieldset>
        <p className="text-xs text-muted-foreground">El modo claro/oscuro se cambia con el botón de la barra superior. La zona horaria se usa para las automatizaciones programadas y para interpretar las fechas de calendarios suscritos.</p>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        {saved && <p role="status" className="text-sm text-success">Cambios guardados.</p>}
        <Button type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Guardar cambios'}</Button>
      </form>
    </Card>
  );
}
