'use client';
import { Pencil, Plus, Share2, Users } from 'lucide-react';
import { useState, useTransition } from 'react';
import { Badge, Button, EmptyState } from '@/components/ui/primitives';
import { ACCOUNT_KINDS } from '@/lib/finance';
import { formatEUR } from '@/lib/utils';
import { unshareAccountAction } from '@/server/actions/finance';
import type { FinanceOverview } from '@/server/finance/queries';
import { AccountForm, ShareDialog } from './account-dialogs';
import type { AccountDTO } from './types';

export function AccountsTab({ o }: { o: FinanceOverview }) {
  const [form, setForm] = useState<{ open: boolean; account?: AccountDTO | null }>({ open: false });
  const [share, setShare] = useState<AccountDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Cuentas manuales: tú registras los movimientos. Las compartidas las ven y editan las dos personas.</p>
        <Button onClick={() => setForm({ open: true })}><Plus size={16} /> Nueva cuenta</Button>
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {o.accounts.length === 0 ? <EmptyState title="Sin cuentas" hint="Crea una cuenta para empezar a registrar movimientos." /> : (
        <ul className="grid gap-3 md:grid-cols-2">
          {o.accounts.map((a) => (
            <li key={a.id} className="rounded-2xl border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><p className="truncate font-medium">{a.name}</p><p className="text-xs text-muted-foreground">{ACCOUNT_KINDS.find((k) => k.id === a.kind)?.label}</p></div>
                {a.isOwner && <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Editar ${a.name}`} onClick={() => setForm({ open: true, account: a })}><Pencil size={14} /></Button>}
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{formatEUR(a.balance, 2)}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {a.shared ? <Badge tone="primary"><Users size={11} />{a.isOwner ? `Compartida con ${a.sharedWith.join(', ') || '—'}` : `De ${a.sharedWith.join(', ')}`}</Badge> : <Badge>Privada</Badge>}
                {a.isOwner && !a.shared && <Button size="sm" variant="outline" onClick={() => setShare(a)}><Share2 size={13} /> Compartir</Button>}
                {a.isOwner && a.shared && <Button size="sm" variant="ghost" disabled={pending} onClick={() => { if (confirm(`¿Dejar de compartir «${a.name}»? La otra persona perderá el acceso.`)) start(async () => { const r = await unshareAccountAction(a.id); setError(r.ok ? null : r.error); }); }}>Dejar de compartir</Button>}
                {a.isOwner && a.shared && <Button size="sm" variant="outline" onClick={() => setShare(a)}>Añadir persona</Button>}
              </div>
            </li>
          ))}
        </ul>
      )}
      <AccountForm open={form.open} onClose={() => setForm({ open: false })} account={form.account} />
      <ShareDialog open={!!share} onClose={() => setShare(null)} account={share} />
    </div>
  );
}
