'use client';
import { Music2, Play } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Platform } from '@/lib/content';
import { CONTENT_NAV } from '@/lib/nav';
import { cn } from '@/lib/utils';

/** Logo de cada plataforma (formas y colores propios, sin usar las marcas registradas). */
export function PlatformMark({ platform, size = 'md' }: { platform: Platform; size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'h-5 w-5 rounded-md' : 'h-10 w-10 rounded-xl';
  const icon = size === 'sm' ? 11 : 20;
  return platform === 'youtube'
    ? <span aria-hidden className={cn('grid shrink-0 place-items-center bg-red-600 text-white', box)}><Play size={icon} fill="currentColor" /></span>
    : <span aria-hidden className={cn('grid shrink-0 place-items-center bg-gradient-to-br from-cyan-400 to-pink-500 text-white', box)}><Music2 size={icon} /></span>;
}

/** Marco común del estudio de contenido: siempre oscuro y con la navegación entre sus secciones. */
export function ContentShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div className="dark space-y-4 rounded-3xl border bg-background p-4 text-foreground sm:p-6">
      <nav aria-label="Estudio de contenido" className="-mx-1 overflow-x-auto px-1 pb-1">
        <ul className="flex w-max gap-1 rounded-xl bg-muted p-1">
          {CONTENT_NAV.map(({ href, label, icon: Icon }) => {
            const on = path === href || path.startsWith(`${href}/`);
            return (
              <li key={href}>
                <Link href={href} aria-current={on ? 'page' : undefined} ref={on ? (el) => { el?.scrollIntoView({ block: 'nearest', inline: 'center' }); } : undefined}
                  className={cn('flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition-colors', on ? 'bg-primary/15 font-medium text-primary' : 'text-muted-foreground hover:text-foreground')}>
                  <Icon size={15} aria-hidden /> {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {children}
    </div>
  );
}

/** Cabecera de cada sección: icono, título (el único h1 de la página), explicación y acciones. */
export function SectionHeader({ icon, title, hint, children }: { icon: React.ReactNode; title: string; hint: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {icon}
      <div className="mr-auto min-w-0">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      {children}
    </div>
  );
}
