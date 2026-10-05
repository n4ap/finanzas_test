'use client';
import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { NAV } from '@/lib/nav';
import { Button } from '@/components/ui/primitives';
import type { SearchHit } from '@/server/search';

const PAGES: SearchHit[] = NAV.flatMap((g) => g.items.map((i) => ({ id: i.href, group: 'Ir a', title: i.label, href: i.href })));

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((o) => !o); }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => { if (open) { setQ(''); setHits([]); setCursor(0); } }, [open]);

  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); setError(false); return; }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(String(res.status));
        setHits(((await res.json()) as { hits: SearchHit[] }).hits);
        setError(false);
      } catch (e) { if ((e as Error).name !== 'AbortError') setError(true); }
      finally { setLoading(false); }
    }, 180);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const pages = needle ? PAGES.filter((p) => p.title.toLowerCase().includes(needle)) : PAGES.slice(0, 6);
    return [...pages, ...hits];
  }, [q, hits]);
  const grouped = useMemo(() => {
    const m = new Map<string, { hit: SearchHit; index: number }[]>();
    results.forEach((hit, index) => m.set(hit.group, [...(m.get(hit.group) ?? []), { hit, index }]));
    return [...m];
  }, [results]);

  const go = (h: SearchHit) => { setOpen(false); router.push(h.href); };

  return (
    <>
      <Button variant="outline" className="hidden h-9 w-56 justify-start text-muted-foreground md:inline-flex" onClick={() => setOpen(true)} aria-label="Abrir buscador global">
        <Search size={15} /> Buscar… <kbd className="ml-auto rounded border px-1.5 text-[10px]">Ctrl K</kbd>
      </Button>
      <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(true)} aria-label="Buscar"><Search size={18} /></Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh]" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="Búsqueda global" className="w-full max-w-xl animate-fade-up overflow-hidden rounded-2xl border bg-card shadow-2xl">
            <div className="flex items-center gap-2 border-b px-4">
              <Search size={16} className="text-muted-foreground" />
              <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setCursor(0); }} placeholder="Busca emails, tareas, eventos, proyectos, finanzas, noticias, viajes, familia…"
                className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)); }
                  if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
                  if (e.key === 'Enter' && results[cursor]) go(results[cursor]!);
                }} />
            </div>
            <div className="max-h-[50vh] overflow-y-auto p-2">
              {error && <p className="p-3 text-sm text-danger">No se pudo buscar. Inténtalo de nuevo.</p>}
              {loading && <p className="p-3 text-xs text-muted-foreground">Buscando…</p>}
              {!loading && !error && q.trim().length >= 2 && hits.length === 0 && <p className="p-3 text-sm text-muted-foreground">Sin resultados para «{q}».</p>}
              {grouped.map(([group, rows]) => (
                <div key={group} className="mb-1">
                  <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{group}</p>
                  {rows.map(({ hit, index }) => (
                    <button key={hit.group + hit.id} onClick={() => go(hit)} onMouseEnter={() => setCursor(index)}
                      className={`flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left text-sm ${index === cursor ? 'bg-primary/10' : ''}`}>
                      <span className="truncate">{hit.title}</span>
                      {hit.subtitle && <span className="shrink-0 text-xs text-muted-foreground">{hit.subtitle}</span>}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
