import { ComingSoon } from '@/components/coming-soon';

export const metadata = { title: 'Salud' };
export default function Page() {
  return <ComingSoon title="Salud" phase={4} description="Peso, entrenamientos, pasos, sueño y objetivos." />;
}
