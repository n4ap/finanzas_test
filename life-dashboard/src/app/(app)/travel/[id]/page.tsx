import { ComingSoon } from '@/components/coming-soon';

export const metadata = { title: 'Viaje' };
export default function Page() {
  return <ComingSoon title="Viaje" phase={4} description="Reservas, itinerario y presupuesto de este viaje." />;
}
