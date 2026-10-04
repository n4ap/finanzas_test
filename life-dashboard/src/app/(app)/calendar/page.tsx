import { ComingSoon } from '@/components/coming-soon';

export const metadata = { title: 'Calendario' };
export default function Page() {
  return <ComingSoon title="Calendario" phase={2} description="Día, semana, mes y agenda con CRUD de eventos y arquitectura multicalendario." />;
}
