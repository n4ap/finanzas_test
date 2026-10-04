'use client';
import { AlertTriangle, Bell, CalendarClock, CheckSquare, CreditCard, Mail, Sparkles, TrendingUp, Zap } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Badge, Button, EmptyState } from '@/components/ui/primitives';
import { markAllNotificationsRead, markNotificationRead } from '@/server/actions/notifications';

export interface NotificationDTO { id: string; type: string; title: string; body: string | null; href: string | null; read: boolean; createdAt: string }

const ICONS: Record<string, typeof Bell> = { email: Mail, event: CalendarClock, task: CheckSquare, payment: CreditCard, finance: TrendingUp, automation: Zap, ai: Sparkles };

export function NotificationCenter({ items }: { items: NotificationDTO[] }) {
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const unread = items.filter((n) => !n.read).length;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <Button variant="ghost" size="icon" aria-label={`Notificaciones${unread ? `, ${unread} sin leer` : ''}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Bell size={18} />
        {unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">{unread}</span>}
      </Button>
      {open && (
        <div role="dialog" aria-label="Centro de notificaciones" className="absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] animate-fade-up rounded-2xl border bg-card p-2 shadow-xl">
          <div className="flex items-center justify-between px-2 py-1">
            <p className="text-sm font-semibold">Notificaciones</p>
            {unread > 0 && <button className="text-xs text-primary hover:underline" onClick={() => start(() => markAllNotificationsRead())}>Marcar todas como leídas</button>}
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {items.length === 0 && <li><EmptyState title="Todo al día" hint="No tienes notificaciones." /></li>}
            {items.map((n) => {
              const Icon = ICONS[n.type] ?? AlertTriangle;
              const body = (
                <div className="flex gap-3 rounded-xl p-2 hover:bg-muted">
                  <Icon size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium">{n.title}{!n.read && <Badge tone="primary">nueva</Badge>}</p>
                    {n.body && <p className="truncate text-xs text-muted-foreground">{n.body}</p>}
                  </div>
                </div>
              );
              return <li key={n.id} onClick={() => !n.read && start(() => markNotificationRead(n.id))}>{n.href ? <Link href={n.href} onClick={() => setOpen(false)}>{body}</Link> : body}</li>;
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
