'use client';
import { safeHttpUrl } from '@/lib/url';
import { ExternalLink, Flame } from 'lucide-react';
import { useState, useTransition } from 'react';
import { Badge, EmptyState, Segmented } from '@/components/ui/primitives';
import { NEWS_CATEGORIES, categoryLabel } from '@/lib/news';
import { cn } from '@/lib/utils';
import { setFollowedCategories } from '@/server/actions/news';
import type { NewsDTO } from './types';

const PAGE = 8;

function Thumb({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  const [failed, setFailed] = useState(!src);
  return failed
    ? <div aria-hidden className={cn('bg-gradient-to-br from-primary/20 to-primary/5', className)} />
    // eslint-disable-next-line @next/next/no-img-element
    : <img src={src!} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} className={cn('object-cover', className)} />;
}

const when = (iso: string) => {
  const h = Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000);
  return h < 1 ? 'hace menos de 1 h' : h < 24 ? `hace ${h} h` : `hace ${Math.round(h / 24)} d`;
};

export function NewsView({ top, articles, followed }: { top: NewsDTO[]; articles: NewsDTO[]; followed: string[] }) {
  const [cat, setCat] = useState<string>('all');
  const [shown, setShown] = useState(PAGE);
  const [pending, start] = useTransition();
  const list = articles.filter((a) => cat === 'all' || a.category === cat);
  const toggleFollow = (id: string) => {
    const next = followed.includes(id) ? followed.filter((f) => f !== id) : [...followed, id];
    start(async () => { await setFollowedCategories(next); });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Noticias</h1>

      <section aria-label="Lo importante de hoy" className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><Flame size={16} className="text-warning" /> Lo importante de hoy <span className="font-normal text-muted-foreground">· máximo 5</span></h2>
        {top.length === 0 ? <EmptyState title="Sin noticias recientes" hint="Cuando lleguen noticias de las últimas horas aparecerán aquí." /> : (
          <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {top.map((n, i) => (
              <li key={n.id} className={cn('overflow-hidden rounded-2xl border bg-card', i === 0 && 'md:col-span-2 xl:col-span-1 xl:row-span-1')}>
                <a href={safeHttpUrl(n.url) ?? '#'} target="_blank" rel="noopener noreferrer" className="flex h-full flex-col">
                  <Thumb src={n.imageUrl} alt="" className="h-32 w-full" />
                  <div className="flex flex-1 flex-col gap-1.5 p-3">
                    <div className="flex items-center gap-2"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">{i + 1}</span><Badge>{categoryLabel(n.category)}</Badge></div>
                    <p className="font-medium leading-snug">{n.title}</p>
                    <p className="text-sm text-muted-foreground">{n.shortSummary}</p>
                    <p className="mt-auto flex items-center gap-1 pt-1 text-xs text-muted-foreground">{n.source} · {when(n.publishedAt)} <ExternalLink size={11} /></p>
                  </div>
                </a>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-label="Por categoría" className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="overflow-x-auto"><Segmented label="Categoría" value={cat} onChange={(v) => { setCat(v); setShown(PAGE); }} options={[{ value: 'all', label: 'Todas' }, ...NEWS_CATEGORIES.map((c) => ({ value: c.id as string, label: c.label }))]} /></div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground" role="group" aria-label="Categorías que sigo">
          <span>Priorizar:</span>
          {NEWS_CATEGORIES.map((c) => (
            <button key={c.id} onClick={() => toggleFollow(c.id)} disabled={pending} aria-pressed={followed.includes(c.id)}
              className={cn('rounded-full border px-2 py-0.5', followed.includes(c.id) ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted')}>{c.label}</button>
          ))}
        </div>
        {list.length === 0 ? <EmptyState title="Sin noticias en esta categoría" /> : (
          <>
            <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
              {list.slice(0, shown).map((n) => (
                <li key={n.id}>
                  <a href={safeHttpUrl(n.url) ?? '#'} target="_blank" rel="noopener noreferrer" className="flex gap-3 p-3 hover:bg-muted/50">
                    <Thumb src={n.imageUrl} alt="" className="h-16 w-24 shrink-0 rounded-lg" />
                    <div className="min-w-0"><p className="line-clamp-2 text-sm font-medium">{n.title}</p><p className="line-clamp-2 text-xs text-muted-foreground">{n.shortSummary}</p><p className="mt-1 text-xs text-muted-foreground">{n.source} · {categoryLabel(n.category)} · {when(n.publishedAt)}</p></div>
                  </a>
                </li>
              ))}
            </ul>
            {list.length > shown
              ? <button onClick={() => setShown((s) => s + PAGE)} className="w-full rounded-xl border py-2 text-sm text-muted-foreground hover:bg-muted">Mostrar más ({list.length - shown} restantes)</button>
              : <p className="text-center text-xs text-muted-foreground">Has llegado al final: {list.length} noticias.</p>}
          </>
        )}
      </section>
    </div>
  );
}
