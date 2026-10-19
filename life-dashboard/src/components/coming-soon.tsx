import { Construction } from 'lucide-react';
import { Card, EmptyState } from '@/components/ui/primitives';

export function ComingSoon({ title, phase, description }: { title: string; phase: number; description: string }) {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold">{title}</h1>
      <Card className="p-6"><EmptyState icon={<Construction size={28} />} title={`Disponible en la Fase ${phase}`} hint={description} /></Card>
    </div>
  );
}
