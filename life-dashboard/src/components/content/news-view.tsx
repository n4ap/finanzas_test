'use client';
import { ExternalLink, Lightbulb, Plus, Rss, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Badge, Button, EmptyState, Input } from '@/components/ui/primitives';
import { useRun } from '@/components/ui/use-run';
import { setContentKeywordsAction } from '@/server/actions/content';
import { PostForm, type PostDraft } from './post-form';
import { SectionHeader } from './shell';

export interface ContentNewsItem { id: string; title: string; source: string; url: string; summary: string; publishedAt: string; matched: string[] }

const when = (s: string) => new Date(s).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: 'Europe/Madrid' }).replace(/\./g, '');

/** Palabras clave que filtran las noticias: se guardan al añadir o quitar. */
function Keywords({ keywords }: { keywords: string[] }) {
  const { pending, error, run } = useRun();
  const [draft, setDraft] = useState('');
  const save = (next: string[]) => run(() => setContentKeywordsAction(next));
  return (
    <section aria-label="Palabras clave" className="space-y-2 rounded-2xl border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">Te muestro las noticias de tus feeds que hablen de:</p>
      <ul className="flex flex-wrap gap-1.5">
        {keywords.map((k) => (
          <li key={k}><span className="inline-flex items-center gap-1 rounded-full bg-primary/15 py-0.5 pl-2.5 pr-1 text-sm text-primary">{k}
            <button type="button" disabled={pending} onClick={() => save(keywords.filter((x) => x !== k))} aria-label={`Quitar «${k}»`} className="grid h-5 w-5 place-items-center rounded-full hover:bg-primary/20"><X size={12} /></button></span></li>
        ))}
        {keywords.length === 0 && <li className="text-sm text-muted-foreground">Ninguna: añade alguna.</li>}
      </ul>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const k = draft.trim(); if (k) save([...keywords, k]); setDraft(''); }}>
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={40} placeholder="Añadir tema, p. ej. «Boeing» o «Shorts»" aria-label="Nueva palabra clave" className="max-w-xs" />
        <Button type="submit" variant="outline" disabled={pending || !draft.trim()}><Plus size={16} /> Añadir</Button>
      </form>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </section>
  );
}

export function ContentNewsView({ keywords, items, scanned, feeds }: { keywords: string[]; items: ContentNewsItem[]; scanned: number; feeds: number }) {
  const [only, setOnly] = useState<string | null>(null);
  const [idea, setIdea] = useState<PostDraft | null>(null);
  const shown = only ? items.filter((i) => i.matched.includes(only)) : items;
  const counts = keywords.map((k) => ({ k, n: items.filter((i) => i.matched.includes(k)).length })).filter((c) => c.n > 0);
  return (
    <div className="space-y-4">
      <SectionHeader icon={<span aria-hidden className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary"><Rss size={20} /></span>}
        title="Noticias del sector" hint="Las noticias de tus feeds que tocan tus temas, juntas y listas para convertirlas en ideas" />
      <Keywords keywords={keywords} />

      {counts.length > 1 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por tema">
          <Button size="sm" variant={only === null ? 'primary' : 'outline'} onClick={() => setOnly(null)} aria-pressed={only === null}>Todas ({items.length})</Button>
          {counts.map(({ k, n }) => <Button key={k} size="sm" variant={only === k ? 'primary' : 'outline'} onClick={() => setOnly(only === k ? null : k)} aria-pressed={only === k}>{k} ({n})</Button>)}
        </div>
      )}

      {shown.length === 0 ? (
        <div className="rounded-2xl border bg-card">
          <EmptyState icon={<Rss size={28} />} title={feeds === 0 && scanned === 0 ? 'No tienes feeds de noticias' : 'Ninguna noticia reciente sobre tus temas'}
            hint={feeds === 0 && scanned === 0 ? 'Añádelos en Ajustes → Conexiones.' : `He revisado ${scanned} noticias de los últimos 60 días. Prueba con otras palabras${feeds === 0 ? ' o añade feeds en Ajustes → Conexiones' : ' o añade más feeds'}.`} />
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((i) => (
            <li key={i.id} className="flex flex-col rounded-2xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">{i.source} · {when(i.publishedAt)}</p>
              <a href={i.url} target="_blank" rel="noopener noreferrer" className="mt-1 font-semibold leading-snug hover:underline">{i.title}<ExternalLink size={12} className="ml-1 inline align-baseline text-muted-foreground" aria-hidden /></a>
              <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{i.summary}</p>
              <div className="mt-2 flex flex-wrap gap-1">{i.matched.map((m) => <Badge key={m} tone="primary">{m}</Badge>)}</div>
              <div className="mt-auto pt-3">
                <Button size="sm" variant="outline" onClick={() => setIdea({ title: i.title, notes: `Basado en: ${i.title} (${i.source})\n${i.url}`.slice(0, 1000) })}><Lightbulb size={14} /> Convertir en idea</Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <aside className="rounded-2xl border bg-card p-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Consejo: sigue también los canales de YouTube de tu competencia</p>
        <p className="mt-1">Cada canal tiene un feed: <code className="rounded bg-muted px-1">https://www.youtube.com/feeds/videos.xml?channel_id=…</code> (el identificador sale en la dirección del canal o en «Compartir canal → Copiar ID»). Añádelo en <Link href="/settings" className="text-primary hover:underline">Ajustes → Conexiones</Link> y sus vídeos nuevos aparecerán aquí si coinciden con tus temas.</p>
      </aside>

      {idea && <PostForm key={idea.title} open onClose={() => setIdea(null)} draft={idea} />}
    </div>
  );
}
