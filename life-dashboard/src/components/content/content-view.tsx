'use client';
import { AlertTriangle, CalendarClock, CheckCircle2, Clapperboard, FileEdit, ListTodo, Pencil, Plus, Send } from 'lucide-react';
import { useState } from 'react';
import { Badge, Button, EmptyState, Segmented } from '@/components/ui/primitives';
import { useRun } from '@/components/ui/use-run';
import { POST_STATUS_LABEL, POST_TYPE_LABEL, contentBoard, isOverdue, type PostStatus } from '@/lib/content';
import { cn } from '@/lib/utils';
import { setContentStatusAction } from '@/server/actions/content';
import type { ContentPostDTO } from '@/server/life/content';
import { PostForm } from './post-form';

type Tab = 'scheduled' | 'drafts' | 'published' | 'pending';
const TABS: { value: Tab; label: string }[] = [
  { value: 'scheduled', label: 'Programadas' }, { value: 'drafts', label: 'Borradores' }, { value: 'published', label: 'Publicadas' }, { value: 'pending', label: 'Pendientes' },
];
const STATUS_TONE: Record<PostStatus, 'neutral' | 'important' | 'primary' | 'success'> = { idea: 'neutral', draft: 'important', scheduled: 'primary', published: 'success' };

const fmtWhen = (s: string) => new Date(s).toLocaleString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' }).replace(/\./g, '');

function dateLine(p: ContentPostDTO) {
  if (p.status === 'published' && p.publishedAt) return `Publicada · ${fmtWhen(p.publishedAt)}`;
  if (p.scheduledAt) return `${p.status === 'scheduled' ? 'Programada' : 'Prevista'} · ${fmtWhen(p.scheduledAt)}`;
  return 'Sin fecha';
}

function Stat({ icon, label, value, hint, active, alert, onClick }: { icon: React.ReactNode; label: string; value: number; hint: string; active: boolean; alert?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={cn('rounded-2xl border bg-card p-4 text-left transition-colors hover:bg-muted/60', active && 'border-primary/60 ring-1 ring-primary/40')}>
      <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">{icon}{label}</span>
      <span className="mt-1 block text-2xl font-semibold tabular-nums">{value}</span>
      <span className={cn('text-xs', alert ? 'text-danger' : 'text-muted-foreground')}>{hint}</span>
    </button>
  );
}

function PostCard({ p, now, onEdit, onSchedule }: { p: ContentPostDTO; now: Date; onEdit: () => void; onSchedule: () => void }) {
  const { pending, error, run } = useRun();
  const late = isOverdue(p, now);
  const quick = p.status === 'scheduled' ? { label: 'Marcar publicada', icon: <CheckCircle2 size={14} />, go: () => run(() => setContentStatusAction(p.id, 'published')) }
    : p.status === 'idea' ? { label: 'Pasar a borrador', icon: <FileEdit size={14} />, go: () => run(() => setContentStatusAction(p.id, 'draft')) }
    : p.status === 'draft' ? { label: 'Programar', icon: <Send size={14} />, go: onSchedule }
    : null;
  return (
    <li className={cn('flex flex-col rounded-2xl border bg-card p-4', late && 'border-danger/50')}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={STATUS_TONE[p.status]}>{POST_STATUS_LABEL[p.status]}</Badge>
        <Badge>{POST_TYPE_LABEL[p.type]}</Badge>
        {late && <Badge tone="urgent"><AlertTriangle size={12} aria-hidden /> Atrasada</Badge>}
      </div>
      <h3 className="mt-2 font-semibold leading-snug">{p.title}</h3>
      {p.caption && <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm text-muted-foreground">{p.caption}</p>}
      {p.hashtags && <p className="mt-1 line-clamp-1 text-xs text-primary">{p.hashtags}</p>}
      <p className={cn('mt-3 flex items-center gap-1.5 text-xs', late ? 'text-danger' : 'text-muted-foreground')}><CalendarClock size={14} aria-hidden className="shrink-0" />{dateLine(p)}</p>
      {error && <p role="alert" className="mt-2 text-xs text-danger">{error}</p>}
      <div className="mt-auto flex flex-wrap gap-2 pt-3">
        <Button size="sm" variant="outline" onClick={onEdit} aria-label={`Editar «${p.title}»`}><Pencil size={14} /> Editar</Button>
        {quick && <Button size="sm" variant="ghost" disabled={pending} onClick={quick.go}>{quick.icon} {quick.label}</Button>}
      </div>
    </li>
  );
}

/** Registro de pendientes: todo lo que falta por publicar en una lista cronológica. */
function PendingLog({ posts, now, onEdit }: { posts: ContentPostDTO[]; now: Date; onEdit: (p: ContentPostDTO) => void }) {
  return (
    <ol className="divide-y rounded-2xl border bg-card" aria-label="Registro de publicaciones pendientes">
      {posts.map((p) => {
        const late = isOverdue(p, now);
        return (
          <li key={p.id}>
            <button type="button" onClick={() => onEdit(p)} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left hover:bg-muted/50">
              <span className={cn('w-40 shrink-0 text-xs tabular-nums', late ? 'font-medium text-danger' : 'text-muted-foreground')}>{p.scheduledAt ? fmtWhen(p.scheduledAt) : 'Sin fecha'}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.title}</span>
              <span className="flex gap-1.5">
                <Badge>{POST_TYPE_LABEL[p.type]}</Badge>
                {late ? <Badge tone="urgent">Atrasada</Badge> : <Badge tone={STATUS_TONE[p.status]}>{POST_STATUS_LABEL[p.status]}</Badge>}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

const EMPTY: Record<Tab, { title: string; hint: string }> = {
  scheduled: { title: 'No hay publicaciones programadas', hint: 'Pon fecha y hora a un borrador y cámbialo a «Programada».' },
  drafts: { title: 'No hay ideas ni borradores', hint: 'Pulsa «Nueva idea» para apuntar la próxima publicación.' },
  published: { title: 'Aún no has publicado nada', hint: 'Cuando subas una programada, márcala como publicada.' },
  pending: { title: 'Nada pendiente', hint: 'Todo lo que tenías está publicado.' },
};

export function ContentView({ posts }: { posts: ContentPostDTO[] }) {
  const [now] = useState(() => new Date());
  const [tab, setTab] = useState<Tab>('scheduled');
  const [form, setForm] = useState<{ post: ContentPostDTO | null; preset?: PostStatus } | null>(null);
  const board = contentBoard(posts, now);
  const s = board.stats;
  const list = board[tab];
  return (
    // El panel es siempre oscuro, independientemente del tema de la app.
    <div className="dark space-y-4 rounded-3xl border bg-background p-4 text-foreground sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <span aria-hidden className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-pink-500 text-white"><Clapperboard size={20} /></span>
        <div className="mr-auto">
          <h1 className="text-xl font-semibold">TikTok</h1>
          <p className="text-xs text-muted-foreground">Panel de contenido: ideas, borradores, programadas y publicadas</p>
        </div>
        <Button onClick={() => setForm({ post: null })}><Plus size={16} /> Nueva idea</Button>
      </div>

      <section aria-label="Resumen" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<CalendarClock size={14} />} label="Programadas" value={s.scheduled} hint={`${s.thisWeek} en los próximos 7 días`} active={tab === 'scheduled'} onClick={() => setTab('scheduled')} />
        <Stat icon={<FileEdit size={14} />} label="Borradores" value={s.drafts} hint="Ideas y borradores" active={tab === 'drafts'} onClick={() => setTab('drafts')} />
        <Stat icon={<CheckCircle2 size={14} />} label="Publicadas" value={s.published} hint="Contenido ya subido" active={tab === 'published'} onClick={() => setTab('published')} />
        <Stat icon={<ListTodo size={14} />} label="Pendientes" value={s.pending} hint={s.overdue ? `${s.overdue} ${s.overdue === 1 ? 'atrasada' : 'atrasadas'}` : 'Sin atrasos'} alert={s.overdue > 0} active={tab === 'pending'} onClick={() => setTab('pending')} />
      </section>

      <div className="-mx-1 overflow-x-auto px-1 pb-1"><Segmented label="Sección de contenido" value={tab} onChange={setTab} options={TABS} /></div>

      <section aria-label={TABS.find((t) => t.value === tab)!.label}>
        {list.length === 0 ? (
          <div className="rounded-2xl border bg-card"><EmptyState icon={<Clapperboard size={28} />} {...EMPTY[tab]} /></div>
        ) : tab === 'pending' ? (
          <PendingLog posts={list} now={now} onEdit={(p) => setForm({ post: p })} />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {list.map((p) => <PostCard key={p.id} p={p} now={now} onEdit={() => setForm({ post: p })} onSchedule={() => setForm({ post: p, preset: 'scheduled' })} />)}
          </ul>
        )}
      </section>

      {form && <PostForm key={form.post?.id ?? 'new'} open onClose={() => setForm(null)} post={form.post} preset={form.preset} />}
    </div>
  );
}
