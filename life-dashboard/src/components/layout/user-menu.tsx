'use client';
import { LogOut, Settings } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { logoutAction } from '@/server/actions/auth';

export function UserMenu({ name, email }: { name: string; email: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const initials = name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-label="Menú de usuario" aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">{initials}</button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-56 animate-fade-up rounded-2xl border bg-card p-2 shadow-xl">
          <div className="px-2 py-1.5"><p className="text-sm font-medium">{name}</p><p className="truncate text-xs text-muted-foreground">{email}</p></div>
          <Link href="/settings" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted"><Settings size={15} /> Ajustes</Link>
          <form action={logoutAction}><button className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted"><LogOut size={15} /> Cerrar sesión</button></form>
        </div>
      )}
    </div>
  );
}
