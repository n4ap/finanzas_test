import { ComingSoon } from '@/components/coming-soon';

export const metadata = { title: 'Noticias' };
export default function Page() {
  return <ComingSoon title="Noticias" phase={2} description="Noticias personalizadas por categoría y resumen de «Lo importante de hoy»." />;
}
