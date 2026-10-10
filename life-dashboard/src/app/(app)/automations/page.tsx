import { AutomationsView } from '@/components/automations/automations-view';
import type { AutomationDTO } from '@/components/automations/automation-form';
import { db } from '@/lib/db';
import { describeAutomation } from '@/lib/automations';
import { requireUser } from '@/server/auth';
import { listPending } from '@/server/ai/proposals';

export const metadata = { title: 'Automatizaciones' };
export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await requireUser();
  const [rows, pending] = await Promise.all([db.automation.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } }), listPending(user.id)]);
  const automations: AutomationDTO[] = rows.map((a) => ({
    id: a.id, name: a.name, triggerType: a.triggerType, triggerConfig: a.triggerConfig as Record<string, number>, actionType: a.actionType, actionConfig: a.actionConfig as Record<string, string>,
    requiresConfirmation: a.requiresConfirmation, enabled: a.enabled, lastRunAt: a.lastRunAt?.toISOString() ?? null, description: describeAutomation(a),
  }));
  return <AutomationsView automations={automations} pending={pending} />;
}
