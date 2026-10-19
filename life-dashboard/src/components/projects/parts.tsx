import { AlertTriangle, CheckCircle2, CircleDashed, PauseCircle, TrendingUp, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/primitives';
import { PROJECT_HEALTH_LABEL, type ProjectHealth } from '@/lib/projects';

const HEALTH: Record<ProjectHealth, { tone: 'neutral' | 'urgent' | 'important' | 'success' | 'primary'; icon: LucideIcon }> = {
  empty: { tone: 'neutral', icon: CircleDashed }, done: { tone: 'success', icon: CheckCircle2 }, paused: { tone: 'neutral', icon: PauseCircle },
  late: { tone: 'urgent', icon: AlertTriangle }, at_risk: { tone: 'important', icon: AlertTriangle }, on_track: { tone: 'primary', icon: TrendingUp },
};

/** Estado con icono y texto: el color nunca va solo. */
export function HealthBadge({ health }: { health: ProjectHealth }) {
  const { tone, icon: Icon } = HEALTH[health];
  return <Badge tone={tone}><Icon size={11} aria-hidden />{PROJECT_HEALTH_LABEL[health]}</Badge>;
}

export function ProgressBar({ pct, color, label }: { pct: number; color: string; label: string }) {
  const v = Math.round(pct * 100);
  return (
    <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="h-full rounded-full" style={{ width: `${v}%`, background: color }} />
    </div>
  );
}

export const fmtTarget = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : null);
