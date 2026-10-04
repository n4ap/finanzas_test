import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-2xl border bg-card shadow-sm', className)} {...p} />;
}

const button = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:opacity-90',
        ghost: 'hover:bg-muted text-foreground',
        outline: 'border bg-card hover:bg-muted',
        danger: 'bg-danger text-white hover:opacity-90',
      },
      size: { sm: 'h-8 px-3', md: 'h-10 px-4', icon: 'h-9 w-9' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof button> {}
export function Button({ className, variant, size, ...p }: ButtonProps) {
  return <button className={cn(button({ variant, size }), className)} {...p} />;
}

const badge = cva('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', {
  variants: {
    tone: {
      neutral: 'bg-muted text-muted-foreground',
      urgent: 'bg-danger/15 text-danger',
      important: 'bg-warning/15 text-warning',
      success: 'bg-success/15 text-success',
      primary: 'bg-primary/15 text-primary',
    },
  },
  defaultVariants: { tone: 'neutral' },
});
export function Badge({ tone, className, ...p }: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>) {
  return <span className={cn(badge({ tone }), className)} {...p} />;
}

export function Input({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn('h-10 w-full rounded-xl border bg-card px-3 text-sm placeholder:text-muted-foreground', className)} {...p} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-muted', className)} />;
}

export function EmptyState({ icon, title, hint }: { icon?: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-muted-foreground">
      {icon}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {hint && <p className="max-w-xs text-xs">{hint}</p>}
    </div>
  );
}

export function ErrorState({ message = 'No se pudo cargar esta sección.', onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-2 py-8 text-center">
      <p className="text-sm text-danger">{message}</p>
      {onRetry && <Button variant="outline" size="sm" onClick={onRetry}>Reintentar</Button>}
    </div>
  );
}
