import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/auth-form';
import { registerAction } from '@/server/actions/auth';
import { getCurrentUser } from '@/server/auth';

export const metadata = { title: 'Crear cuenta' };
export default async function RegisterPage() {
  if (await getCurrentUser()) redirect('/dashboard');
  return <AuthForm mode="register" action={registerAction} />;
}
