import { redirect } from 'next/navigation';
import { AuthForm } from '@/components/auth-form';
import { loginAction } from '@/server/actions/auth';
import { getCurrentUser } from '@/server/auth';

export const metadata = { title: 'Entrar' };
export default async function LoginPage() {
  if (await getCurrentUser()) redirect('/dashboard');
  return <AuthForm mode="login" action={loginAction} />;
}
