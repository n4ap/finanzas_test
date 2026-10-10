'use client';
import { AlertTriangle, ArrowRight, Info, Siren } from 'lucide-react';
import Link from 'next/link';
import type { Insight } from '@/lib/coach';
import { cn } from '@/lib/utils';

const ICON = { alert: Siren, warn: AlertTriangle, info: Info } as const;
const TONE = { alert: 'border-danger/40 bg-danger/5', warn: 'border-warning/40 bg-warning/5', info: 'border-border bg-card' } as const;

/** Observaciones del coach: directas, con el porqué y un enlace a donde se actúa. */
export function InsightList({ items, max }: { items: Insight[]; max?: number }) {
  const shown = max ? items.slice(0, max) : items;
  if (shown.length === 0) return <p className="text-sm text-muted-foreground">Nada que señalar ahora mismo. Buen trabajo: mantén el foco en tus prioridades.</p>;
  return (
    <ul className="space-y-2">
      {shown.map((i) => {
        const Icon = ICON[i.level];
        return (
          <li key={i.id} className={cn('rounded-xl border p-3', TONE[i.level])}>
            <p className="flex items-start gap-2 text-sm font-medium"><Icon size={16} aria-hidden className={cn('mt-0.5 shrink-0', i.level === 'alert' ? 'text-danger' : i.level === 'warn' ? 'text-warning' : 'text-muted-foreground')} />{i.title}</p>
            <p className="mt-1 pl-6 text-sm text-muted-foreground">{i.detail}</p>
            <Link href={i.href} className="mt-1 inline-flex items-center gap-1 pl-6 text-xs font-medium text-primary hover:underline">Ir <ArrowRight size={12} aria-hidden /></Link>
          </li>
        );
      })}
    </ul>
  );
}
