'use client';
import { Inbox, Mail, Send, Sparkles, Star, Zap } from 'lucide-react';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { Badge, Button, EmptyState } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import { analyzeAllEmails, setEmailFlag } from '@/server/actions/email';
import { EmailDetail } from './email-detail';
import { FOLDER_LABEL, type EmailDTO, type EmailFolder } from './types';

const ICON = { inbox: Inbox, unread: Mail, important: Zap, sent: Send, starred: Star } as const;

export function EmailView({ emails }: { emails: EmailDTO[] }) {
  const [folder, setFolder] = useState<EmailFolder>('inbox');
  const [onlyReply, setOnlyReply] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [info, setInfo] = useState<string | null>(null);

  const counts = useMemo(() => ({
    inbox: emails.filter((e) => e.folder === 'inbox').length,
    unread: emails.filter((e) => e.folder === 'inbox' && !e.read).length,
    important: emails.filter((e) => e.folder === 'inbox' && e.important).length,
    sent: emails.filter((e) => e.folder === 'sent').length,
    starred: emails.filter((e) => e.starred).length,
  }), [emails]);

  const list = useMemo(() => emails.filter((e) => {
    const inFolder = folder === 'sent' ? e.folder === 'sent' : folder === 'starred' ? e.starred : e.folder === 'inbox' && (folder === 'inbox' || (folder === 'unread' && !e.read) || (folder === 'important' && e.important));
    return inFolder && (!onlyReply || (e.needsReply && !e.replied));
  }), [emails, folder, onlyReply]);

  const selected = emails.find((e) => e.id === selectedId) ?? null;
  const pendingAnalysis = emails.filter((e) => e.folder === 'inbox' && !e.summary).length;

  // Abrir un email lo marca como leído (una sola vez).
  useEffect(() => { if (selected && !selected.read && selected.folder === 'inbox') void setEmailFlag(selected.id, 'read', true); }, [selected]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold">Email</h1>
        {pendingAnalysis > 0 && (
          <Button variant="outline" size="sm" disabled={pending} onClick={() => start(async () => { const r = await analyzeAllEmails(); setInfo(r.ok ? `${r.data?.count ?? 0} emails analizados` : r.error); })}><Sparkles size={14} /> Analizar {pendingAnalysis} sin analizar</Button>
        )}
      </div>
      {info && <p role="status" className="text-sm text-muted-foreground">{info}</p>}

      <div className="grid gap-4 lg:grid-cols-[13rem_minmax(0,22rem)_minmax(0,1fr)]">
        <nav aria-label="Carpetas" className={cn('flex gap-1 overflow-x-auto lg:flex-col', selected && 'hidden lg:flex')}>
          {(Object.keys(FOLDER_LABEL) as EmailFolder[]).map((f) => {
            const Icon = ICON[f];
            return (
              <button key={f} onClick={() => { setFolder(f); setSelectedId(null); }} aria-current={folder === f ? 'page' : undefined}
                className={cn('flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm', folder === f ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-muted')}>
                <Icon size={16} className="shrink-0" /> <span className="whitespace-nowrap">{FOLDER_LABEL[f]}</span>
                {counts[f] > 0 && f !== 'sent' && <span className="ml-auto rounded-full bg-muted px-1.5 text-xs">{counts[f]}</span>}
              </button>
            );
          })}
          <label className="mt-2 hidden items-center gap-2 px-3 text-sm text-muted-foreground lg:flex"><input type="checkbox" checked={onlyReply} onChange={(e) => setOnlyReply(e.target.checked)} /> Solo por responder</label>
        </nav>

        <section aria-label="Lista de emails" className={cn('min-w-0', selected && 'hidden lg:block')}>
          <label className="mb-2 flex items-center gap-2 text-sm text-muted-foreground lg:hidden"><input type="checkbox" checked={onlyReply} onChange={(e) => setOnlyReply(e.target.checked)} /> Solo por responder</label>
          {list.length === 0 ? <EmptyState icon={<Mail size={24} />} title="No hay emails aquí" /> : (
            <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
              {list.map((e) => (
                <li key={e.id}>
                  <button onClick={() => setSelectedId(e.id)} aria-current={selectedId === e.id}
                    className={cn('block w-full px-4 py-3 text-left hover:bg-muted/60', selectedId === e.id && 'bg-primary/5')}>
                    <div className="flex items-center gap-2">
                      {!e.read && e.folder === 'inbox' && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="No leído" />}
                      <span className={cn('truncate text-sm', !e.read && e.folder === 'inbox' ? 'font-semibold' : 'font-medium')}>{e.folder === 'sent' ? `Para: ${e.toEmails.join(', ') || 'sin destinatario'}` : e.fromName}</span>
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">{new Date(e.receivedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</span>
                    </div>
                    <p className="truncate text-sm">{e.subject}</p>
                    <p className="truncate text-xs text-muted-foreground">{e.summary ?? e.snippet}</p>
                    {(e.needsReply && !e.replied || e.deadline) && (
                      <div className="mt-1 flex gap-1.5">
                        {e.needsReply && !e.replied && <Badge tone="important">Responder</Badge>}
                        {e.deadline && <Badge tone="urgent">Antes {new Date(e.deadline).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' })}</Badge>}
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Detalle del email" className={cn('min-w-0', !selected && 'hidden lg:block')}>
          {selected ? <EmailDetail key={selected.id} email={selected} onBack={() => setSelectedId(null)} /> : <div className="hidden rounded-2xl border border-dashed lg:block"><EmptyState title="Selecciona un email" hint="Verás su resumen, fechas límite y acciones de IA." /></div>}
        </section>
      </div>
    </div>
  );
}
