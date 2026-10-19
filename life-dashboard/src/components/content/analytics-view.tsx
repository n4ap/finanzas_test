'use client';
import { ChartColumn, Eye, Heart, MessageCircle, Share2, Trophy } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { HorizontalBars } from '@/components/charts/bars';
import { ChartCard } from '@/components/charts/chart-card';
import { ColumnsChart } from '@/components/charts/columns-chart';
import { EmptyState, Segmented } from '@/components/ui/primitives';
import { PLATFORM_META, POST_TYPE_LABEL, contentAnalytics, type Platform } from '@/lib/content';
import type { ContentPostDTO } from '@/server/life/content';
import { fmtWhen } from './post-form';
import { PlatformMark, SectionHeader } from './shell';

type Filter = 'all' | Platform;
type Period = '30' | '90' | '365' | 'all';
const n = (v: number) => v.toLocaleString('es-ES');
const compact = (v: number) => (v >= 1_000_000 ? `${(v / 1_000_000).toLocaleString('es-ES', { maximumFractionDigits: 1 })} M` : v >= 10_000 ? `${(v / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 })} mil` : n(v));

function Kpi({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">{icon}{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export function AnalyticsView({ posts }: { posts: ContentPostDTO[] }) {
  const [now] = useState(() => new Date());
  const [filter, setFilter] = useState<Filter>('all');
  const [period, setPeriod] = useState<Period>('90');
  const a = contentAnalytics(posts, { platform: filter === 'all' ? null : filter, days: period === 'all' ? null : Number(period) }, now);
  const periodLabel = period === 'all' ? 'desde el principio' : `en los últimos ${period} días`;

  return (
    <div className="space-y-4">
      <SectionHeader icon={<span aria-hidden className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary"><ChartColumn size={20} /></span>}
        title="Análisis" hint="Resultados de lo publicado: los anotas al editar cada publicación publicada" />
      <div className="flex flex-wrap gap-2">
        <Segmented label="Plataforma" value={filter} onChange={setFilter} options={[{ value: 'all', label: 'Todas' }, { value: 'youtube', label: 'YouTube' }, { value: 'tiktok', label: 'TikTok' }]} />
        <Segmented label="Periodo" value={period} onChange={setPeriod} options={[{ value: '30', label: '30 días' }, { value: '90', label: '90 días' }, { value: '365', label: '1 año' }, { value: 'all', label: 'Todo' }]} />
      </div>

      {a.published === 0 ? (
        <div className="rounded-2xl border bg-card"><EmptyState icon={<ChartColumn size={28} />} title={`Nada publicado ${periodLabel}`} hint="Cuando marques publicaciones como publicadas y anotes sus visualizaciones, aquí verás cómo funcionan." /></div>
      ) : (
        <>
          <section aria-label="Resumen de resultados" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi icon={<ChartColumn size={14} />} label="Publicadas" value={n(a.published)} hint={a.measured < a.published ? `${a.published - a.measured} sin resultados anotados` : 'Todas con resultados'} />
            <Kpi icon={<Eye size={14} />} label="Visualizaciones" value={compact(a.views)} hint={a.avgViews !== null ? `${compact(a.avgViews)} de media por publicación` : 'Sin datos todavía'} />
            <Kpi icon={<Heart size={14} />} label="Interacción" value={a.engagement !== null ? `${(a.engagement * 100).toLocaleString('es-ES', { maximumFractionDigits: 1 })} %` : '—'} hint="Me gusta + comentarios + compartidos sobre visualizaciones" />
            <Kpi icon={<Trophy size={14} />} label="Mejor día" value={a.bestWeekday ?? '—'} hint={a.bestWeekday ? 'Más visualizaciones de media' : 'Anota visualizaciones para saberlo'} />
          </section>

          <div className="grid gap-3 lg:grid-cols-2">
            <ChartCard title="Publicaciones por semana" subtitle="Últimas 12 semanas" table={{ columns: ['Semana del', 'Publicaciones'], rows: a.weekly.map((w) => [w.label, w.posts]) }}>
              <ColumnsChart data={a.weekly} series={[{ key: 'posts', label: 'Publicaciones', color: 'var(--series-1)' }]} format={n} ariaLabel="Publicaciones por semana en las últimas 12 semanas" />
            </ChartCard>
            <ChartCard title="Visualizaciones por semana" subtitle="De lo publicado cada semana" table={{ columns: ['Semana del', 'Visualizaciones'], rows: a.weekly.map((w) => [w.label, n(w.views)]) }}>
              <ColumnsChart data={a.weekly} series={[{ key: 'views', label: 'Visualizaciones', color: 'var(--series-3)' }]} format={compact} ariaLabel="Visualizaciones por semana en las últimas 12 semanas" />
            </ChartCard>
            {a.measured === 0 ? (
              <p className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground lg:col-span-2">Para ver qué tipo de publicación y qué día funcionan mejor, anota las visualizaciones de lo publicado (Editar → Resultados).</p>
            ) : (
              <>
                <ChartCard title="Media de visualizaciones por tipo" subtitle="Qué formato funciona mejor" table={{ columns: ['Tipo', 'Publicaciones', 'Media'], rows: a.byType.map((t) => [POST_TYPE_LABEL[t.type], t.posts, t.avgViews !== null ? n(t.avgViews) : '—']) }}>
                  <HorizontalBars ariaLabel="Media de visualizaciones por tipo de publicación" rows={a.byType.filter((t) => t.avgViews !== null).map((t) => ({ key: t.type, label: POST_TYPE_LABEL[t.type], value: t.avgViews!, display: compact(t.avgViews!), note: `${t.posts} ${t.posts === 1 ? 'publicación' : 'publicaciones'}` }))} />
                </ChartCard>
                <ChartCard title="Media de visualizaciones por día" subtitle="Día de la semana en que se publicó (solo días con datos)" table={{ columns: ['Día', 'Publicaciones', 'Media'], rows: a.byWeekday.map((d) => [d.day, d.posts, d.avgViews !== null ? n(d.avgViews) : '—']) }}>
                  <HorizontalBars ariaLabel="Media de visualizaciones por día de la semana" rows={a.byWeekday.filter((d) => d.avgViews !== null).map((d) => ({ key: d.day, label: d.day, value: d.avgViews!, display: compact(d.avgViews!) }))} />
                </ChartCard>
              </>
            )}
          </div>

          <section aria-labelledby="top-title" className="rounded-2xl border bg-card p-4">
            <h2 id="top-title" className="mb-3 text-sm font-semibold">Lo que mejor ha funcionado</h2>
            {a.top.length === 0 ? <p className="text-sm text-muted-foreground">Anota las visualizaciones de tus publicaciones (Editar → Resultados) para ver aquí las mejores.</p> : (
              <ol className="divide-y">
                {a.top.map((p, i) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                    <span className="w-5 text-sm font-semibold tabular-nums text-muted-foreground">{i + 1}</span>
                    <PlatformMark platform={p.platform} size="sm" />
                    <Link href={`/content/${p.platform}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">{p.title}</Link>
                    <span className="text-xs text-muted-foreground">{POST_TYPE_LABEL[p.type]} · {fmtWhen(p.publishedAt!)}</span>
                    <span className="flex gap-3 text-xs tabular-nums">
                      <span className="flex items-center gap-1" title="Visualizaciones"><Eye size={12} aria-hidden />{compact(p.views!)}</span>
                      <span className="flex items-center gap-1" title="Me gusta"><Heart size={12} aria-hidden />{compact(p.likes ?? 0)}</span>
                      <span className="flex items-center gap-1" title="Comentarios"><MessageCircle size={12} aria-hidden />{compact(p.comments ?? 0)}</span>
                      <span className="flex items-center gap-1" title="Compartidos"><Share2 size={12} aria-hidden />{compact(p.shares ?? 0)}</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
          {filter === 'all' && (
            <p className="text-xs text-muted-foreground">
              Por plataforma: {(['youtube', 'tiktok'] as const).map((pl) => `${PLATFORM_META[pl].label} ${posts.filter((p) => p.platform === pl && p.status === 'published').length}`).join(' · ')} publicadas en total.
            </p>
          )}
        </>
      )}
    </div>
  );
}
