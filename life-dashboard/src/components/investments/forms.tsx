'use client';
import { useState, useTransition } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button, Field, Input, Select } from '@/components/ui/primitives';
import { ASSET_TYPES } from '@/lib/finance';
import { addDividendAction, createInvestmentAction, deleteInvestmentAction, updateInvestmentAction } from '@/server/actions/finance';

export interface PositionDTO { id: string; assetType: string; symbol: string; name: string; quantity: number; avgCost: number; currentPrice: number; dividendYield: number; isin?: string | null }

const num = (v: FormDataEntryValue | null) => String(v ?? '').replace(',', '.');

export function PositionForm({ open, onClose, position }: { open: boolean; onClose: () => void; position?: PositionDTO | null }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const editing = !!position;
  return (
    <Dialog open={open} onClose={onClose} title={editing ? `Editar ${position!.symbol}` : 'Nueva posición'}>
      <form key={position?.id ?? 'new'} className="space-y-3" onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const payload = { assetType: f.get('assetType'), symbol: f.get('symbol'), name: f.get('name'), quantity: num(f.get('quantity')), avgCost: num(f.get('avgCost')), currentPrice: num(f.get('currentPrice')), dividendYield: num(f.get('dividendYield')) || '0', isin: f.get('isin') };
        start(async () => { const r = editing ? await updateInvestmentAction(position!.id, payload) : await createInvestmentAction(payload); if (r.ok) { setError(null); onClose(); } else setError(r.error); });
      }}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo"><Select name="assetType" defaultValue={position?.assetType ?? 'etf'}>{ASSET_TYPES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</Select></Field>
          <Field label="Símbolo"><Input name="symbol" required maxLength={20} defaultValue={position?.symbol} placeholder="VWCE" autoFocus /></Field>
        </div>
        <Field label="Nombre"><Input name="name" required maxLength={100} defaultValue={position?.name} /></Field>
        <Field label="ISIN (opcional, para fondos y ETF)"><Input name="isin" maxLength={12} defaultValue={position?.isin ?? ''} placeholder="IE00BK5BQT80" autoComplete="off" spellCheck={false} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cantidad"><Input name="quantity" inputMode="decimal" required defaultValue={position?.quantity} /></Field>
          <Field label="Coste medio (€/ud.)"><Input name="avgCost" inputMode="decimal" required defaultValue={position?.avgCost} /></Field>
          <Field label="Precio actual (€/ud.)"><Input name="currentPrice" inputMode="decimal" required defaultValue={position?.currentPrice} /></Field>
          <Field label="Rentab. por dividendo (%/año)"><Input name="dividendYield" inputMode="decimal" defaultValue={position?.dividendYield ?? 0} /></Field>
        </div>
        <p className="text-xs text-muted-foreground">Puedes escribir el precio a mano o usar «Actualizar precios». Con el ISIN, la app busca el fondo o ETF en Yahoo Finance.</p>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-between pt-2">
          {editing ? <Button type="button" variant="ghost" className="text-danger" disabled={pending} onClick={() => { if (confirm(`¿Eliminar ${position!.symbol} y sus dividendos registrados?`)) start(async () => { const r = await deleteInvestmentAction(position!.id); if (r.ok) onClose(); else setError(r.error); }); }}>Eliminar</Button> : <span />}
          <div className="flex gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={pending}>Guardar</Button></div>
        </div>
      </form>
    </Dialog>
  );
}

export function DividendForm({ open, onClose, positions }: { open: boolean; onClose: () => void; positions: PositionDTO[] }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onClose={onClose} title="Registrar dividendo cobrado">
      <form className="space-y-3" onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        start(async () => { const r = await addDividendAction({ investmentId: f.get('investmentId'), date: f.get('date'), amount: num(f.get('amount')) }); if (r.ok) { setError(null); onClose(); } else setError(r.error); });
      }}>
        <Field label="Posición"><Select name="investmentId">{positions.map((p) => <option key={p.id} value={p.id}>{p.symbol} · {p.name}</option>)}</Select></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha"><Input name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></Field>
          <Field label="Importe neto (€)"><Input name="amount" inputMode="decimal" required autoFocus /></Field>
        </div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={pending}>Guardar</Button></div>
      </form>
    </Dialog>
  );
}
