'use client';
import { CalendarRange, CheckCircle2, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button, Segmented } from '@/components/ui/primitives';
import { CONTENT_TZ, PLATFORM_META, POST_STATUS_LABEL, dayKeyOf, isOverdue, monthGrid, postDate, shiftMonth, type Platform } from '@/lib/content';
import { cn } from '@/lib/utils';
import type { ContentPostDTO } from '@/server/life/content';
import { PostForm, type PostDraft } from './post-form';
import { PlatformMark, SectionHeader } from './shell';

type Filter = 'all' | Platform;
const FILTERS: { value: Filter; label: string }[] = [{ value: 'all', label: 'Todas' }, { value: 'youtube', label: 'YouTube' }, { value: 'tiktok', label: 'TikTok' }];
const WEEK = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const hour = (s: string) => new Date(s).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: CONTENT_TZ });
const monthTitle = (m: string) => { const t = new Date(`${m}-15T12:00:00Z`).toLocaleDateString('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' }); return t[0]!.toUpperCase() + t.slice(1); };
const dayTitle = (k: string) => new Date(`${k}T12:00:00Z`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

function Chip({ p, now, onOpen }: { p: ContentPostDTO; now: Date; onOpen: () => void }) {
  const late = isOverdue(p, now);
  const when = postDate(p)!;
  return (
    <button type="button" onClick={onOpen} title={`${PLATFORM_META[p.platform].label} · ${POST_STATUS_LABEL[p.status]} · ${p.title}`}
      className={cn('flex w-full items-center gap-1.5 rounded-lg border-l-2 bg-muted/60 px-1.5 py-1 text-left text-xs hover:bg-muted', late && 'bg-danger/10 text-danger', p.status === 'idea' || p.status === 'draft' ? 'border-dashed opacity-80' : '')}
      style={{ borderLeftColor: PLATFORM_META[p.platform].color }}>
      <PlatformMark platform={p.platform} size="sm" />
      <span className="tabular-nums text-muted-foreground">{hour(when)}</span>
      <span className="min-w-0 flex-1 truncate">{p.title}</span>
      {p.status === 'published' && <CheckCircle2 size={12} className="shrink-0 text-success" aria-label="Publicada" />}
    </button>
  );
}

export function CalendarView({ month, today, posts }: { month: string; today: string; posts: ContentPostDTO[] }) {
  const [now] = useState(() => new Date());
  const [filter, setFilter] = useState<Filter>('all');
  const [form, setForm] = useState<{ post: ContentPostDTO | null; draft?: PostDraft } | null>(null);
  const weeks = monthGrid(month);
  const byDay = new Map<string, ContentPostDTO[]>();
  for (const p of posts) {
    const d = postDate(p);
    if (!d || (filter !== 'all' && p.platform !== filter)) continue;
    const k = dayKeyOf(d);
    byDay.set(k, [...(byDay.get(k) ?? []), p]);
  }
  for (const list of byDay.values()) list.sort((a, b) => postDate(a)!.localeCompare(postDate(b)!));
  const inMonth = weeks.flat().filter((k) => k.slice(0, 7) === month);
  const count = inMonth.reduce((a, k) => a + (byDay.get(k)?.length ?? 0), 0);
  const unscheduled = posts.filter((p) => !postDate(p) && p.status !== 'published' && (filter === 'all' || p.platform === filter)).length;
  const newOn = (k: string) => setForm({ post: null, draft: { scheduledAt: new Date(`${k}T18:00:00`).toISOString() } });

  return (
    <div className="space-y-4">
      <SectionHeader icon={<span aria-hidden className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary"><CalendarRange size={20} /></span>}
        title="Calendario editorial" hint="Todo lo programado y publicado en YouTube y TikTok, día a día">
        <Button onClick={() => setForm({ post: null })}><Plus size={16} /> Nueva idea</Button>
      </SectionHeader>

      <div className="flex flex-wrap items-center gap-2">
        <Link href={`?m=${shiftMonth(month, -1)}`} aria-label="Mes anterior" className="grid h-9 w-9 place-items-center rounded-xl border bg-card hover:bg-muted"><ChevronLeft size={16} /></Link>
        <h2 className="min-w-40 text-center font-semibold" aria-live="polite">{monthTitle(month)}</h2>
        <Link href={`?m=${shiftMonth(month, 1)}`} aria-label="Mes siguiente" className="grid h-9 w-9 place-items-center rounded-xl border bg-card hover:bg-muted"><ChevronRight size={16} /></Link>
        {month !== today.slice(0, 7) && <Link href="?" className="rounded-xl border bg-card px-3 py-1.5 text-sm hover:bg-muted">Hoy</Link>}
        <span className="mr-auto text-xs text-muted-foreground">{count} {count === 1 ? 'publicación' : 'publicaciones'} este mes{unscheduled ? ` · ${unscheduled} sin fecha` : ''}</span>
        <Segmented label="Plataforma" value={filter} onChange={setFilter} options={FILTERS} />
      </div>

      {/* Escritorio: cuadrícula del mes */}
      <div className="hidden overflow-hidden rounded-2xl border md:block">
        <div className="grid grid-cols-7 border-b bg-card text-xs font-medium text-muted-foreground">{WEEK.map((d) => <div key={d} className="px-2 py-2">{d}</div>)}</div>
        <div role="grid" aria-label={`Calendario de ${monthTitle(month)}`}>
          {weeks.map((w) => (
            <div key={w[0]} role="row" className="grid grid-cols-7 border-b last:border-0">
              {w.map((k) => {
                const list = byDay.get(k) ?? [];
                const out = k.slice(0, 7) !== month;
                return (
                  <div key={k} role="gridcell" aria-label={dayTitle(k)} className={cn('group min-h-28 space-y-1 border-r p-1.5 last:border-r-0', out ? 'bg-background/60 text-muted-foreground/60' : 'bg-card')}>
                    <div className="flex items-center justify-between">
                      <span className={cn('grid h-6 w-6 place-items-center rounded-full text-xs tabular-nums', k === today && 'bg-primary font-semibold text-primary-foreground')}>{Number(k.slice(8))}</span>
                      <button type="button" onClick={() => newOn(k)} aria-label={`Añadir el ${dayTitle(k)}`} className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground opacity-0 hover:bg-muted focus:opacity-100 group-hover:opacity-100"><Plus size={14} /></button>
                    </div>
                    {list.slice(0, 4).map((p) => <Chip key={p.id} p={p} now={now} onOpen={() => setForm({ post: p })} />)}
                    {list.length > 4 && <p className="px-1 text-[11px] text-muted-foreground">y {list.length - 4} más</p>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Móvil: agenda con los días que tienen algo */}
      <ol className="space-y-3 md:hidden" aria-label={`Agenda de ${monthTitle(month)}`}>
        {inMonth.filter((k) => byDay.has(k)).map((k) => (
          <li key={k} className="rounded-2xl border bg-card p-3">
            <h3 className={cn('mb-2 text-sm font-semibold first-letter:uppercase', k === today && 'text-primary')}>{dayTitle(k)}{k === today ? ' · hoy' : ''}</h3>
            <div className="space-y-1.5">{byDay.get(k)!.map((p) => <Chip key={p.id} p={p} now={now} onOpen={() => setForm({ post: p })} />)}</div>
          </li>
        ))}
        {count === 0 && <li className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">Nada programado este mes.</li>}
      </ol>

      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-3 w-0.5 rounded" style={{ background: PLATFORM_META.youtube.color }} />YouTube</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-0.5 rounded" style={{ background: PLATFORM_META.tiktok.color }} />TikTok</span>
        <span>Borde discontinuo: idea o borrador con fecha prevista</span>
        <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-success" />Publicada</span>
      </p>

      {form && <PostForm key={form.post?.id ?? `new-${form.draft?.scheduledAt}`} open onClose={() => setForm(null)} post={form.post} draft={form.draft} />}
    </div>
  );
}
