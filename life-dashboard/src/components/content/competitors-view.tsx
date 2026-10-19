'use client';
import { ExternalLink, Pencil, Plus, Telescope, TrendingDown, TrendingUp, X } from 'lucide-react';
import { useState } from 'react';
import { Sparkline } from '@/components/charts';
import { Dialog } from '@/components/ui/dialog';
import { Badge, Button, EmptyState, Field, Input, Segmented, Select, Textarea } from '@/components/ui/primitives';
import { useRun } from '@/components/ui/use-run';
import { PLATFORMS, PLATFORM_META, competitorTrend, dayKeyOf, type Platform } from '@/lib/content';
import { cn } from '@/lib/utils';
import { addSnapshotAction, createCompetitorAction, deleteCompetitorAction, deleteSnapshotAction, updateCompetitorAction } from '@/server/actions/content';
import type { CompetitorDTO } from '@/server/life/content';
import { PlatformMark, SectionHeader } from './shell';

type Filter = 'all' | Platform;
// Hex (no variables CSS): la miniatura usa el color en el id de su degradado. Son los tonos oscuros de --series-2 y --series-1.
const SPARK: Record<Platform, string> = { youtube: '#d95926', tiktok: '#3987e5' };
const n = (v: number) => v.toLocaleString('es-ES');
const pct = (v: number) => `${v > 0 ? '+' : ''}${(v * 100).toLocaleString('es-ES', { maximumFractionDigits: 1 })} %`;
const signed = (v: number) => `${v > 0 ? '+' : ''}${n(v)}`;
const fmtDay = (k: string) => new Date(`${k}T12:00:00Z`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).replace(/\./g, '');
const footer = (onClose: () => void, pending: boolean, left?: React.ReactNode) => (
  <div className="flex justify-between pt-2">{left ?? <span />}<div className="flex gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Guardar'}</Button></div></div>
);

function CompetitorForm({ c, onClose }: { c: CompetitorDTO | null; onClose: () => void }) {
  const { pending, error, run } = useRun();
  return (
    <Dialog open onClose={onClose} title={c ? `Editar ${c.name}` : 'Seguir una cuenta'}>
      <form className="space-y-3" onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const payload = { platform: f.get('platform'), name: f.get('name'), handle: f.get('handle'), url: f.get('url'), notes: f.get('notes'), mine: f.get('mine') === 'on' };
        run(() => (c ? updateCompetitorAction(c.id, payload) : createCompetitorAction(payload)), () => onClose());
      }}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Plataforma"><Select name="platform" defaultValue={c?.platform ?? 'youtube'}>{PLATFORMS.map((p) => <option key={p} value={p}>{PLATFORM_META[p].label}</option>)}</Select></Field>
          <Field label="Usuario (@)"><Input name="handle" maxLength={60} defaultValue={c?.handle ?? ''} placeholder="@canal" /></Field>
          <Field label="Nombre" className="col-span-2"><Input name="name" required maxLength={80} defaultValue={c?.name} autoFocus /></Field>
          <Field label="Enlace al canal o perfil" className="col-span-2"><Input name="url" type="url" maxLength={300} defaultValue={c?.url ?? ''} placeholder="https://www.youtube.com/@canal" /></Field>
        </div>
        <Field label="Notas (qué hace bien, formatos, frecuencia…)"><Textarea name="notes" maxLength={1000} defaultValue={c?.notes ?? ''} /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="mine" defaultChecked={c?.mine} className="h-4 w-4" /> Es mi cuenta (para compararme)</label>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        {footer(onClose, pending, c ? <Button type="button" variant="ghost" className="text-danger" disabled={pending} onClick={() => { if (confirm(`¿Dejar de seguir «${c.name}» y borrar sus datos?`)) run(() => deleteCompetitorAction(c.id), () => onClose()); }}>Eliminar</Button> : undefined)}
      </form>
    </Dialog>
  );
}

function SnapshotForm({ c, onClose }: { c: CompetitorDTO; onClose: () => void }) {
  const { pending, error, run } = useRun();
  const last = c.snapshots.at(-1);
  const today = dayKeyOf(new Date().toISOString());
  return (
    <Dialog open onClose={onClose} title={`Anotar datos de ${c.name}`}>
      <form className="space-y-3" onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        run(() => addSnapshotAction(c.id, { date: f.get('date'), followers: f.get('followers'), avgViews: f.get('avgViews'), posts: f.get('posts') }), () => onClose());
      }}>
        <p className="text-xs text-muted-foreground">Míralo en su perfil{c.url ? ' (enlace en la tarjeta)' : ''}. Si ya anotaste ese día, se sustituye.</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha"><Input name="date" type="date" required defaultValue={today} max={today} /></Field>
          <Field label={c.platform === 'youtube' ? 'Suscriptores' : 'Seguidores'}><Input name="followers" required inputMode="numeric" defaultValue={last?.followers ?? ''} autoFocus /></Field>
          <Field label="Media de visualizaciones"><Input name="avgViews" inputMode="numeric" defaultValue={last?.avgViews ?? ''} placeholder="Opcional" /></Field>
          <Field label={c.platform === 'youtube' ? 'Vídeos publicados' : 'Publicaciones'}><Input name="posts" inputMode="numeric" defaultValue={last?.posts ?? ''} placeholder="Opcional" /></Field>
        </div>
        {c.snapshots.length > 0 && (
          <details className="rounded-xl border p-2 text-sm">
            <summary className="cursor-pointer text-xs text-muted-foreground">Historial ({c.snapshots.length})</summary>
            <ul className="mt-2 max-h-48 divide-y overflow-auto">
              {[...c.snapshots].reverse().map((s) => (
                <li key={s.id} className="flex items-center gap-2 py-1.5 text-xs">
                  <span className="w-28 text-muted-foreground">{fmtDay(s.date)}</span>
                  <span className="flex-1 tabular-nums">{n(s.followers)}{s.avgViews !== null ? ` · ${n(s.avgViews)} de media` : ''}</span>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label={`Borrar el dato del ${fmtDay(s.date)}`} disabled={pending} onClick={() => run(() => deleteSnapshotAction(s.id))}><X size={14} /></Button>
                </li>
              ))}
            </ul>
          </details>
        )}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        {footer(onClose, pending)}
      </form>
    </Dialog>
  );
}

function CompetitorCard({ c, onEdit, onLog }: { c: CompetitorDTO; onEdit: () => void; onLog: () => void }) {
  const t = competitorTrend(c.snapshots);
  const up = (t.growth30 ?? t.change ?? 0) >= 0;
  return (
    <li className={cn('flex flex-col rounded-2xl border bg-card p-4', c.mine && 'border-primary/50')}>
      <div className="flex items-start gap-2">
        <PlatformMark platform={c.platform} size="sm" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold leading-tight">{c.name}</h3>
          {c.handle && <p className="truncate text-xs text-muted-foreground">@{c.handle}</p>}
        </div>
        {c.mine && <Badge tone="primary">Tú</Badge>}
        {c.url && <a href={c.url} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${c.name} en ${PLATFORM_META[c.platform].label}`} className="text-muted-foreground hover:text-foreground"><ExternalLink size={16} /></a>}
      </div>
      {t.last ? (
        <>
          <p className="mt-3 text-2xl font-semibold tabular-nums">{n(t.last.followers)} <span className="text-xs font-normal text-muted-foreground">{c.platform === 'youtube' ? 'suscriptores' : 'seguidores'}</span></p>
          {t.growth30 === null && t.change === null ? (
            <p className="text-xs text-muted-foreground">Primer dato: anota otro más adelante para ver la evolución</p>
          ) : (
            <p className={cn('flex items-center gap-1 text-xs', up ? 'text-success' : 'text-danger')}>
              {up ? <TrendingUp size={14} aria-hidden /> : <TrendingDown size={14} aria-hidden />}
              {t.growth30 !== null ? `${signed(t.growth30)}${t.growth30Pct !== null ? ` (${pct(t.growth30Pct)})` : ''} en ~30 días` : `${signed(t.change!)} desde el dato anterior`}
            </p>
          )}
          {c.snapshots.length > 1 && <div className="mt-2" aria-hidden><Sparkline data={c.snapshots.map((s) => ({ value: s.followers }))} color={SPARK[c.platform]} height={40} /></div>}
          <p className="mt-2 text-xs text-muted-foreground">
            {t.last.avgViews !== null && `${n(t.last.avgViews)} visualizaciones de media · `}{t.last.posts !== null && `${n(t.last.posts)} publicaciones · `}Actualizado el {fmtDay(t.last.date)}
          </p>
        </>
      ) : <p className="mt-3 text-sm text-muted-foreground">Sin datos todavía.</p>}
      {c.notes && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{c.notes}</p>}
      <div className="mt-auto flex flex-wrap gap-2 pt-3">
        <Button size="sm" onClick={onLog}><Plus size={14} /> Anotar datos</Button>
        <Button size="sm" variant="outline" onClick={onEdit} aria-label={`Editar ${c.name}`}><Pencil size={14} /> Editar</Button>
      </div>
    </li>
  );
}

export function CompetitorsView({ competitors }: { competitors: CompetitorDTO[] }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [edit, setEdit] = useState<{ c: CompetitorDTO | null } | null>(null);
  const [log, setLog] = useState<CompetitorDTO | null>(null);
  const list = competitors.filter((c) => filter === 'all' || c.platform === filter);
  const ranking = list.map((c) => ({ c, t: competitorTrend(c.snapshots) })).filter((r) => r.t.last).sort((a, b) => b.t.last!.followers - a.t.last!.followers);
  return (
    <div className="space-y-4">
      <SectionHeader icon={<span aria-hidden className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary"><Telescope size={20} /></span>}
        title="Competencia" hint="Cuentas que sigues de cerca y cómo crecen (los datos los anotas tú de vez en cuando)">
        <Button onClick={() => setEdit({ c: null })}><Plus size={16} /> Seguir cuenta</Button>
      </SectionHeader>
      <Segmented label="Plataforma" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'Todas' }, { value: 'youtube', label: 'YouTube' }, { value: 'tiktok', label: 'TikTok' }]} />

      {list.length === 0 ? (
        <div className="rounded-2xl border bg-card"><EmptyState icon={<Telescope size={28} />} title="Aún no sigues ninguna cuenta" hint="Añade los canales que te inspiran o con los que compites, y también el tuyo marcando «Es mi cuenta» para compararte." /></div>
      ) : (
        <>
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{list.map((c) => <CompetitorCard key={c.id} c={c} onEdit={() => setEdit({ c })} onLog={() => setLog(c)} />)}</ul>
          {ranking.length > 1 && (
            <section aria-labelledby="rank-title" className="rounded-2xl border bg-card p-4">
              <h2 id="rank-title" className="mb-2 text-sm font-semibold">Comparativa</h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[32rem] text-sm">
                  <thead><tr className="border-b text-left text-xs text-muted-foreground"><th scope="col" className="py-1.5 font-medium">Cuenta</th><th scope="col" className="py-1.5 text-right font-medium">Seguidores</th><th scope="col" className="py-1.5 text-right font-medium">~30 días</th><th scope="col" className="py-1.5 text-right font-medium">Media de visualizaciones</th></tr></thead>
                  <tbody>
                    {ranking.map(({ c, t }) => (
                      <tr key={c.id} className={cn('border-b last:border-0', c.mine && 'text-primary')}>
                        <td className="py-1.5"><span className="flex items-center gap-2"><PlatformMark platform={c.platform} size="sm" />{c.name}{c.mine ? ' (tú)' : ''}</span></td>
                        <td className="py-1.5 text-right tabular-nums">{n(t.last!.followers)}</td>
                        <td className={cn('py-1.5 text-right tabular-nums', t.growth30Pct !== null && (t.growth30Pct >= 0 ? 'text-success' : 'text-danger'))}>{t.growth30Pct !== null ? pct(t.growth30Pct) : '—'}</td>
                        <td className="py-1.5 text-right tabular-nums">{t.last!.avgViews !== null ? n(t.last!.avgViews) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
      {edit && <CompetitorForm c={edit.c} onClose={() => setEdit(null)} />}
      {log && <SnapshotForm c={competitors.find((c) => c.id === log.id) ?? log} onClose={() => setLog(null)} />}
    </div>
  );
}
