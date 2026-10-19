'use client';
import { useState, useTransition } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button, Field, Input, Select } from '@/components/ui/primitives';
import { EXPENSE_CATEGORIES, categorize } from '@/lib/finance';
import { createTransactionAction, deleteTransactionAction, updateTransactionAction } from '@/server/actions/finance';
import type { AccountDTO, TxDTO } from './types';

export function TransactionForm({ open, onClose, tx, accounts, defaultAccountId }: { open: boolean; onClose: () => void; tx?: TxDTO | null; accounts: AccountDTO[]; defaultAccountId?: string }) {
  const [kind, setKind] = useState<'expense' | 'income'>(tx ? (tx.amount > 0 ? 'income' : 'expense') : 'expense');
  const [category, setCategory] = useState(tx?.category ?? 'otros');
  const [touchedCategory, setTouchedCategory] = useState(!!tx);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const editing = !!tx;
  const today = new Date().toISOString().slice(0, 10);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const abs = Math.abs(Number(String(f.get('amount')).replace(',', '.')));
    const payload = {
      accountId: f.get('accountId'), date: f.get('date'), amount: kind === 'income' ? abs : -abs, category: kind === 'income' ? 'ingresos' : category,
      description: f.get('description'), merchant: f.get('merchant') || undefined, recurring: f.get('recurring') === 'on', upcoming: f.get('upcoming') === 'on',
    };
    start(async () => {
      const r = editing ? await updateTransactionAction(tx!.id, payload) : await createTransactionAction(payload);
      if (r.ok) { setError(null); onClose(); } else setError(r.error);
    });
  };

  return (
    <Dialog open={open} onClose={onClose} title={editing ? 'Editar movimiento' : 'Nuevo movimiento'}>
      <form key={tx?.id ?? 'new'} onSubmit={submit} className="space-y-3">
        <div role="radiogroup" aria-label="Tipo" className="inline-flex rounded-xl bg-muted p-0.5">
          {(['expense', 'income'] as const).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={`rounded-lg px-4 py-1.5 text-sm ${kind === k ? 'bg-card font-medium shadow-sm' : 'text-muted-foreground'}`}>{k === 'expense' ? 'Gasto' : 'Ingreso'}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Importe (€)"><Input name="amount" inputMode="decimal" required defaultValue={tx ? Math.abs(tx.amount) : ''} placeholder="0,00" autoFocus /></Field>
          <Field label="Fecha"><Input name="date" type="date" required defaultValue={tx?.date ?? today} /></Field>
        </div>
        <Field label="Concepto"><Input name="description" required maxLength={200} defaultValue={tx?.description}
          onChange={(e) => { if (!touchedCategory && kind === 'expense') setCategory(categorize(e.target.value, -1)); }} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cuenta"><Select name="accountId" defaultValue={tx?.accountId ?? defaultAccountId ?? accounts[0]?.id}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}{a.shared ? ' (compartida)' : ''}</option>)}</Select></Field>
          {kind === 'expense' && <Field label="Categoría"><Select value={category} onChange={(e) => { setCategory(e.target.value); setTouchedCategory(true); }}>{EXPENSE_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select></Field>}
        </div>
        <Field label="Comercio (opcional)"><Input name="merchant" maxLength={100} defaultValue={tx?.merchant ?? ''} /></Field>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" name="recurring" defaultChecked={tx?.recurring} /> Recurrente</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="upcoming" defaultChecked={tx?.upcoming} /> Pago previsto (aún no cargado)</label>
        </div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-between pt-2">
          {editing ? <Button type="button" variant="ghost" className="text-danger" disabled={pending} onClick={() => { if (confirm('¿Eliminar este movimiento? Quedará constancia en el historial de cambios.')) start(async () => { const r = await deleteTransactionAction(tx!.id); if (r.ok) onClose(); else setError(r.error); }); }}>Eliminar</Button> : <span />}
          <div className="flex gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Guardar'}</Button></div>
        </div>
      </form>
    </Dialog>
  );
}
