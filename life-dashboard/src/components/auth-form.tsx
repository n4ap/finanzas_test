'use client';
import Link from 'next/link';
import { useActionState } from 'react';
import { Button, Card, Input } from '@/components/ui/primitives';
import type { FormState } from '@/server/actions/auth';

type Action = (s: FormState, f: FormData) => Promise<FormState>;

export function AuthForm({ mode, action }: { mode: 'login' | 'register'; action: Action }) {
  const [state, formAction, pending] = useActionState(action, {});
  const isLogin = mode === 'login';
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm animate-fade-up p-6">
        <div className="mb-6">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-lg text-primary-foreground">◐</div>
          <h1 className="text-xl font-semibold">{isLogin ? 'Bienvenido de nuevo' : 'Crea tu cuenta'}</h1>
          <p className="text-sm text-muted-foreground">Life Dashboard · tus datos son tuyos</p>
        </div>
        <form action={formAction} className="space-y-3">
          {!isLogin && <Input name="name" defaultValue={state.name} placeholder="Nombre" autoComplete="name" required />}
          <Input name="email" type="email" defaultValue={state.email} placeholder="Email" autoComplete="email" required />
          <Input name="password" type="password" placeholder={isLogin ? 'Contraseña' : 'Contraseña (mín. 10 caracteres)'} autoComplete={isLogin ? 'current-password' : 'new-password'} required />
          {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
          <Button type="submit" className="w-full" disabled={pending}>{pending ? 'Un momento…' : isLogin ? 'Entrar' : 'Crear cuenta'}</Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          {isLogin ? '¿Sin cuenta? ' : '¿Ya tienes cuenta? '}
          <Link className="text-primary hover:underline" href={isLogin ? '/register' : '/login'}>{isLogin ? 'Regístrate' : 'Entra'}</Link>
        </p>
        {isLogin && <p className="mt-3 rounded-lg bg-muted p-2 text-center text-xs text-muted-foreground">Demo: demo@lifedashboard.dev / demo-password-123</p>}
      </Card>
    </main>
  );
}
