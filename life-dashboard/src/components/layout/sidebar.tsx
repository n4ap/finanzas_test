'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV, MOBILE_NAV } from '@/lib/nav';
import { cn } from '@/lib/utils';

const active = (path: string, href: string) => path === href || path.startsWith(href + '/');

export function Sidebar() {
  const path = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-4 overflow-y-auto border-r bg-card/50 p-4 lg:flex">
      <Link href="/dashboard" className="flex items-center gap-2 px-2 py-1 font-semibold">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">◐</span> Life Dashboard
      </Link>
      <nav className="flex flex-col gap-4" aria-label="Navegación principal">
        {NAV.map((g) => (
          <div key={g.group} className="flex flex-col gap-0.5">
            <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{g.group}</p>
            {g.items.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} aria-current={active(path, href) ? 'page' : undefined}
                className={cn('flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors', active(path, href) ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
                <Icon size={17} /> {label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}

export function BottomNav() {
  const path = usePathname();
  return (
    <nav aria-label="Navegación móvil" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      {MOBILE_NAV.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} aria-current={active(path, href) ? 'page' : undefined}
          className={cn('flex flex-col items-center gap-0.5 py-2 text-[11px]', active(path, href) ? 'text-primary' : 'text-muted-foreground')}>
          <Icon size={20} /> {href === '/assistant' ? 'IA' : label}
        </Link>
      ))}
    </nav>
  );
}
