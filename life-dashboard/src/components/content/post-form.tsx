'use client';
import { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button, Field, Input, Select, Textarea } from '@/components/ui/primitives';
import { useRun } from '@/components/ui/use-run';
import { CAPTION_MAX, POST_STATUSES, POST_STATUS_LABEL, POST_TYPES, POST_TYPE_LABEL, type PostStatus } from '@/lib/content';
import { createContentPostAction, deleteContentPostAction, updateContentPostAction } from '@/server/actions/content';
import type { ContentPostDTO } from '@/server/life/content';

const pad = (n: number) => String(n).padStart(2, '0');
const toLocalInput = (iso: string | null) => { if (!iso) return ''; const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const iso = (v: FormDataEntryValue | null) => (v ? new Date(String(v)).toISOString() : '');

/** Alta y edición de una publicación. `preset` abre una nueva (o la existente) con ese estado ya elegido. */
export function PostForm({ open, onClose, post, preset }: { open: boolean; onClose: () => void; post?: ContentPostDTO | null; preset?: PostStatus }) {
  const { pending, error, run } = useRun();
  const editing = !!post;
  const [status, setStatus] = useState<PostStatus>(preset ?? post?.status ?? 'idea');
  const [caption, setCaption] = useState(post?.caption ?? '');
  return (
    <Dialog open={open} onClose={onClose} title={editing ? 'Editar publicación' : 'Nueva idea de publicación'} wide>
      <form className="space-y-3" onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const payload = {
          title: f.get('title'), caption: f.get('caption'), hashtags: f.get('hashtags'), type: f.get('type'), status: f.get('status'),
          scheduledAt: iso(f.get('scheduledAt')), publishedAt: post?.status === 'published' && status === 'published' ? post.publishedAt : '', notes: f.get('notes'),
        };
        run(() => (editing ? updateContentPostAction(post!.id, payload) : createContentPostAction(payload)), () => onClose());
      }}>
        <Field label="Título / gancho"><Input name="title" required maxLength={120} defaultValue={post?.title} placeholder="Ej.: Un día revisando un motor de avión" autoFocus /></Field>
        <label className="block space-y-1">
          <span className="flex justify-between text-xs font-medium text-muted-foreground">Subtítulo (texto de la publicación)<span aria-live="polite" className={caption.length > CAPTION_MAX * 0.9 ? 'text-warning' : ''}>{caption.length}/{CAPTION_MAX}</span></span>
          <Textarea name="caption" maxLength={CAPTION_MAX} value={caption} onChange={(e) => setCaption(e.target.value)} className="min-h-28" placeholder="Lo que se leerá debajo del vídeo" />
        </label>
        <Field label="Hashtags"><Input name="hashtags" maxLength={300} defaultValue={post?.hashtags ?? ''} placeholder="#aviacion #mecanico #fyp" /></Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Tipo"><Select name="type" defaultValue={post?.type ?? 'video'}>{POST_TYPES.map((t) => <option key={t} value={t}>{POST_TYPE_LABEL[t]}</option>)}</Select></Field>
          <Field label="Estado"><Select name="status" value={status} onChange={(e) => setStatus(e.target.value as PostStatus)}>{POST_STATUSES.map((s) => <option key={s} value={s}>{POST_STATUS_LABEL[s]}</option>)}</Select></Field>
          <Field label={status === 'scheduled' ? 'Fecha y hora (obligatoria)' : 'Fecha prevista'}><Input name="scheduledAt" type="datetime-local" required={status === 'scheduled'} defaultValue={toLocalInput(post?.scheduledAt ?? null)} /></Field>
        </div>
        <Field label="Notas (guion, música, ideas de grabación…)"><Textarea name="notes" maxLength={1000} defaultValue={post?.notes ?? ''} /></Field>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-between pt-2">
          {editing ? <Button type="button" variant="ghost" className="text-danger" disabled={pending} onClick={() => { if (confirm(`¿Eliminar «${post!.title}»?`)) run(() => deleteContentPostAction(post!.id), () => onClose()); }}>Eliminar</Button> : <span />}
          <div className="flex gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Guardar'}</Button></div>
        </div>
      </form>
    </Dialog>
  );
}
