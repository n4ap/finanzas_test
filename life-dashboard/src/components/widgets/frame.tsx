import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function WidgetFrame({ title, icon: Icon, href, children }: { title: string; icon: LucideIcon; href?: string; children: ReactNode }) {
  return (
    <section className="flex h-full flex-col gap-3 p-4" aria-label={title}>
      <header className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><Icon size={16} className="text-muted-foreground" /> {title}</h2>
        {href && <Link href={href} className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-primary" aria-label={`Ver ${title}`}>Ver <ArrowUpRight size={12} /></Link>}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

export function Row({ left, right, sub }: { left: ReactNode; right?: ReactNode; sub?: ReactNode }) {
  return (
    <li className="flex items-start justify-between gap-3 py-1.5">
      <div className="min-w-0"><p className="truncate text-sm">{left}</p>{sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}</div>
      {right && <div className="shrink-0 text-xs text-muted-foreground">{right}</div>}
    </li>
  );
}
