import { ComingSoon } from '@/components/coming-soon';

export const metadata = { title: 'Viajes' };
export default function Page() {
  return <ComingSoon title="Viajes" phase={4} description="Próximos viajes, reservas, itinerario y presupuesto." />;
}
