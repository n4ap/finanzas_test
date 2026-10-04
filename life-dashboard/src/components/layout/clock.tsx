'use client';
import { useEffect, useState } from 'react';
import { formatLongDate, formatTime, greeting } from '@/lib/utils';

/** Reloj en cliente (evita desajustes de hidratación: renderiza vacío hasta montar). */
export function GreetingClock({ name }: { name: string }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="w-full min-w-0 sm:w-auto">
      <h1 className="text-xl font-semibold sm:text-2xl">{now ? greeting(now) : 'Hola'}, {name.split(' ')[0]} 👋</h1>
      <p className="text-sm text-muted-foreground" suppressHydrationWarning>{now ? `${formatLongDate(now)} · ${formatTime(now)}` : ' '}</p>
    </div>
  );
}
