'use client';
import { Check, ShieldCheck, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Badge, Button } from '@/components/ui/primitives';
import { useRun } from '@/components/ui/use-run';
import { cancelProposalAction, confirmProposalAction } from '@/server/actions/ai';

export interface ProposalView { id: string; summary: string; status: string; result?: string | null; expired?: boolean }

const STATUS: Record<string, { label: string; tone: 'neutral' | 'success' | 'urgent' | 'primary' }> = {
  pending: { label: 'Pendiente de confirmar', tone: 'primary' }, confirmed: { label: 'Hecho', tone: 'success' }, cancelled: { label: 'Descartada', tone: 'neutral' }, failed: { label: 'Falló', tone: 'urgent' },
};

/** Una acción propuesta: nada se ejecuta hasta pulsar «Confirmar». */
export function ProposalCard({ p, onDone }: { p: ProposalView; onDone?: () => void }) {
  const { pending, error, run } = useRun();
  // Estado local: el resultado sigue visible aunque la lista del servidor ya no incluya la propuesta.
  const [local, setLocal] = useState<{ status: string; result?: string } | null>(null);
  const status = local?.status ?? p.status;
  const result = local ? local.result : p.result;
  const router = useRouter();
  const s = p.expired && !local ? { label: 'Caducada', tone: 'neutral' as const } : (STATUS[status] ?? STATUS.pending!);
  const open = status === 'pending' && !p.expired;
  return (
    <div className="mt-2 rounded-xl border bg-card p-3" data-proposal={p.id}>
      <div className="flex items-start gap-2">
        <ShieldCheck size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden />
        <p className="min-w-0 flex-1 text-sm">{p.summary}</p>
        <Badge tone={s.tone}>{s.label}</Badge>
      </div>
      {result && status !== 'pending' && <p className="mt-1.5 pl-6 text-xs text-muted-foreground">{result}</p>}
      {open && (
        <div className="mt-2 flex gap-2 pl-6">
          <Button size="sm" disabled={pending} onClick={() => run(() => confirmProposalAction(p.id, new Date().getTimezoneOffset()), (res) => { setLocal({ status: 'confirmed', result: res }); onDone?.(); router.refresh(); })}><Check size={14} /> Confirmar</Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => cancelProposalAction(p.id), () => { setLocal({ status: 'cancelled' }); onDone?.(); router.refresh(); })}><X size={14} /> Descartar</Button>
        </div>
      )}
      {error && <p role="alert" className="mt-1.5 pl-6 text-xs text-danger">{error}</p>}
    </div>
  );
}
