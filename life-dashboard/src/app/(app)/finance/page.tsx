import { ComingSoon } from '@/components/coming-soon';

export const metadata = { title: 'Finanzas' };
export default function Page() {
  return <ComingSoon title="Finanzas" phase={3} description="Transacciones, presupuestos, gráficos, importación CSV, cuentas manuales y compartidas." />;
}
