import { History } from 'lucide-react';
import { Badge, EmptyState } from '@/components/ui/primitives';
import type { FinanceOverview } from '@/server/finance/queries';

const ENTITY: Record<string, string> = { Transaction: 'Movimiento', BankAccount: 'Cuenta', Budget: 'Presupuesto', Investment: 'Posición', Dividend: 'Dividendo' };
const ACTION: Record<string, { label: string; tone: 'success' | 'primary' | 'urgent' }> = { create: { label: 'Creado', tone: 'success' }, update: { label: 'Modificado', tone: 'primary' }, delete: { label: 'Eliminado', tone: 'urgent' } };

export function AuditTab({ o }: { o: FinanceOverview }) {
  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-sm text-muted-foreground"><History size={15} /> Cada cambio en tus datos financieros queda registrado con quién lo hizo y el valor anterior. Últimos {o.audit.length}.</p>
      {o.audit.length === 0 ? <EmptyState title="Sin cambios registrados" /> : (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card" aria-label="Historial de cambios">
          {o.audit.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <Badge tone={ACTION[a.action]?.tone ?? 'neutral'}>{ACTION[a.action]?.label ?? a.action}</Badge>
              <span className="min-w-0 flex-1 truncate"><span className="text-muted-foreground">{ENTITY[a.entity] ?? a.entity}</span> · {a.summary}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{a.by} · {new Date(a.at).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
