'use client';
import { useState, useTransition } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button, Field, Input, Select } from '@/components/ui/primitives';
import { ACCOUNT_KINDS } from '@/lib/finance';
import { createAccountAction, deleteAccountAction, shareAccountAction, updateAccountAction } from '@/server/actions/finance';
import type { AccountDTO } from './types';

export function AccountForm({ open, onClose, account }: { open: boolean; onClose: () => void; account?: AccountDTO | null }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const editing = !!account;
  return (
    <Dialog open={open} onClose={onClose} title={editing ? 'Editar cuenta' : 'Nueva cuenta'}>
      <form key={account?.id ?? 'new'} className="space-y-3" onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const payload = { name: f.get('name'), kind: f.get('kind'), openingBalance: String(f.get('openingBalance') ?? '0').replace(',', '.') || '0' };
        start(async () => { const r = editing ? await updateAccountAction(account!.id, payload) : await createAccountAction(payload); if (r.ok) { setError(null); onClose(); } else setError(r.error); });
      }}>
        <Field label="Nombre"><Input name="name" required maxLength={60} defaultValue={account?.name} autoFocus /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo"><Select name="kind" defaultValue={account?.kind ?? 'checking'}>{ACCOUNT_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</Select></Field>
          <Field label="Saldo inicial (€)"><Input name="openingBalance" inputMode="decimal" defaultValue={account?.openingBalance ?? 0} /></Field>
        </div>
        <p className="text-xs text-muted-foreground">Cuenta manual: el saldo es el inicial más los movimientos registrados. No hay conexión con ningún banco.</p>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-between pt-2">
          {editing ? <Button type="button" variant="ghost" className="text-danger" disabled={pending} onClick={() => { if (confirm(`¿Eliminar «${account!.name}» y TODOS sus movimientos? Esta acción no se puede deshacer (queda constancia en el historial).`)) start(async () => { const r = await deleteAccountAction(account!.id); if (r.ok) onClose(); else setError(r.error); }); }}>Eliminar cuenta</Button> : <span />}
          <div className="flex gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={pending}>Guardar</Button></div>
        </div>
      </form>
    </Dialog>
  );
}

export function ShareDialog({ open, onClose, account }: { open: boolean; onClose: () => void; account: AccountDTO | null }) {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!account) return null;
  return (
    <Dialog open={open} onClose={() => { setDone(null); setError(null); onClose(); }} title={`Compartir «${account.name}»`}>
      <form className="space-y-3" onSubmit={(e) => {
        e.preventDefault();
        const email = String(new FormData(e.currentTarget).get('email'));
        if (!confirm(`La otra persona podrá ver y editar TODOS los movimientos de «${account.name}». ¿Compartir con ${email}?`)) return;
        start(async () => { const r = await shareAccountAction({ accountId: account.id, email }); if (r.ok) { setError(null); setDone(r.data?.sharedWith ?? ''); } else setError(r.error); });
      }}>
        <p className="text-sm text-muted-foreground">La persona debe tener ya una cuenta en la aplicación. Verá y podrá editar los movimientos de esta cuenta, pero nada más de tus finanzas. Puedes dejar de compartirla cuando quieras.</p>
        <Field label="Email de la otra persona"><Input name="email" type="email" required autoFocus /></Field>
        {done && <p role="status" className="text-sm text-success">Cuenta compartida con {done}.</p>}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => { setDone(null); setError(null); onClose(); }}>Cerrar</Button><Button type="submit" disabled={pending}>Compartir</Button></div>
      </form>
    </Dialog>
  );
}
