'use client';
import { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button, Field, Input, Select, Textarea } from '@/components/ui/primitives';
import { useRun } from '@/components/ui/use-run';
import { CONTENT_TZ, PLATFORMS, PLATFORM_META, POST_STATUSES, POST_STATUS_LABEL, POST_TYPE_LABEL, type Platform, type PostStatus } from '@/lib/content';
import { createContentPostAction, deleteContentPostAction, updateContentPostAction } from '@/server/actions/content';
import type { ContentPostDTO } from '@/server/life/content';

const pad = (n: number) => String(n).padStart(2, '0');
const toLocalInput = (iso: string | null) => { if (!iso) return ''; const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const iso = (v: FormDataEntryValue | null) => (v ? new Date(String(v)).toISOString() : '');
export const fmtWhen = (s: string) => new Date(s).toLocaleString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: CONTENT_TZ }).replace(/\./g, '');

/** Datos con los que abrir una publicación nueva (desde el calendario o una noticia). */
export interface PostDraft { title?: string; notes?: string; scheduledAt?: string }

/**
 * Alta y edición de una publicación. Sin `platform` ni `post` (calendario, noticias) deja elegir la plataforma.
 * `preset` abre con ese estado ya elegido. Los resultados (visualizaciones…) solo aparecen si está publicada.
 */
export function PostForm({ open, onClose, platform: fixed, post, preset, draft }: { open: boolean; onClose: () => void; platform?: Platform; post?: ContentPostDTO | null; preset?: PostStatus; draft?: PostDraft }) {
  const { pending, error, run } = useRun();
  const editing = !!post;
  const [platform, setPlatform] = useState<Platform>(post?.platform ?? fixed ?? 'youtube');
  const [status, setStatus] = useState<PostStatus>(preset ?? post?.status ?? 'idea');
  const [caption, setCaption] = useState(post?.caption ?? '');
  const meta = PLATFORM_META[platform];
  const chooser = !post && !fixed;
  return (
    <Dialog open={open} onClose={onClose} title={editing ? `Editar publicación de ${meta.label}` : chooser ? 'Nueva idea de publicación' : `Nueva idea para ${meta.label}`} wide>
      <form className="space-y-3" onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const payload = {
          platform, title: f.get('title'), caption: f.get('caption'), hashtags: f.get('hashtags'), type: f.get('type'), status: f.get('status'),
          scheduledAt: iso(f.get('scheduledAt')), publishedAt: post?.status === 'published' && status === 'published' ? post.publishedAt : '', notes: f.get('notes'),
          views: f.get('views') ?? '', likes: f.get('likes') ?? '', comments: f.get('comments') ?? '', shares: f.get('shares') ?? '',
        };
        run(() => (editing ? updateContentPostAction(post!.id, payload) : createContentPostAction(payload)), () => onClose());
      }}>
        {chooser && (
          <Field label="Plataforma"><Select name="platform" value={platform} onChange={(e) => setPlatform(e.target.value as Platform)}>{PLATFORMS.map((p) => <option key={p} value={p}>{PLATFORM_META[p].label}</option>)}</Select></Field>
        )}
        <Field label={platform === 'youtube' ? 'Título del vídeo' : 'Título / gancho'}><Input name="title" required maxLength={meta.titleMax} defaultValue={post?.title ?? draft?.title?.slice(0, meta.titleMax)} placeholder={platform === 'youtube' ? 'Ej.: Así se revisa un motor de avión por dentro' : 'Ej.: Un día revisando un motor de avión'} autoFocus /></Field>
        <label className="block space-y-1">
          <span className="flex justify-between text-xs font-medium text-muted-foreground">{meta.captionLabel}<span aria-live="polite" className={caption.length > meta.captionMax * 0.9 ? 'text-warning' : ''}>{caption.length}/{meta.captionMax}</span></span>
          <Textarea name="caption" maxLength={meta.captionMax} value={caption} onChange={(e) => setCaption(e.target.value)} className="min-h-28" placeholder={platform === 'youtube' ? 'Lo que irá en la descripción del vídeo' : 'Lo que se leerá debajo del vídeo'} />
        </label>
        <Field label={platform === 'youtube' ? 'Etiquetas / hashtags' : 'Hashtags'}><Input name="hashtags" maxLength={300} defaultValue={post?.hashtags ?? ''} placeholder="#aviacion #mecanico" /></Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Tipo"><Select key={platform} name="type" defaultValue={post && meta.types.includes(post.type) ? post.type : meta.types[0]}>{meta.types.map((t) => <option key={t} value={t}>{POST_TYPE_LABEL[t]}</option>)}</Select></Field>
          <Field label="Estado"><Select name="status" value={status} onChange={(e) => setStatus(e.target.value as PostStatus)}>{POST_STATUSES.map((s) => <option key={s} value={s}>{POST_STATUS_LABEL[s]}</option>)}</Select></Field>
          <Field label={status === 'scheduled' ? 'Fecha y hora (obligatoria)' : 'Fecha prevista'}><Input name="scheduledAt" type="datetime-local" required={status === 'scheduled'} defaultValue={toLocalInput(post?.scheduledAt ?? draft?.scheduledAt ?? null)} /></Field>
        </div>
        {status === 'published' && (
          <fieldset className="rounded-xl border p-3">
            <legend className="px-1 text-xs font-medium text-muted-foreground">Resultados (cópialos de {meta.label} Studio / estadísticas)</legend>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Visualizaciones"><Input name="views" inputMode="numeric" defaultValue={post?.views ?? ''} /></Field>
              <Field label="Me gusta"><Input name="likes" inputMode="numeric" defaultValue={post?.likes ?? ''} /></Field>
              <Field label="Comentarios"><Input name="comments" inputMode="numeric" defaultValue={post?.comments ?? ''} /></Field>
              <Field label="Compartidos"><Input name="shares" inputMode="numeric" defaultValue={post?.shares ?? ''} /></Field>
            </div>
          </fieldset>
        )}
        <Field label="Notas (guion, música, ideas de grabación…)"><Textarea name="notes" maxLength={1000} defaultValue={post?.notes ?? draft?.notes ?? ''} /></Field>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-between pt-2">
          {editing ? <Button type="button" variant="ghost" className="text-danger" disabled={pending} onClick={() => { if (confirm(`¿Eliminar «${post!.title}»?`)) run(() => deleteContentPostAction(post!.id), () => onClose()); }}>Eliminar</Button> : <span />}
          <div className="flex gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Guardar'}</Button></div>
        </div>
      </form>
    </Dialog>
  );
}
