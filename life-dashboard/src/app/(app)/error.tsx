'use client';
import { ErrorState } from '@/components/ui/primitives';

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return <ErrorState message="Algo salió mal al cargar esta página." onRetry={reset} />;
}
