import { Skeleton } from '@/components/ui/primitives';

export default function Loading() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Cargando dashboard">
      {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className={`h-56 rounded-2xl ${i < 2 ? 'md:col-span-2 xl:col-span-1' : ''}`} />)}
    </div>
  );
}
