'use client';
import { useState, useTransition } from 'react';
import type { ActionResult } from '@/server/actions/result';

/** Ejecuta una server action con estado de espera y error visible (role="alert" en el formulario que lo use). */
export function useRun() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = <T,>(fn: () => Promise<ActionResult<T>>, onOk?: (data: T | undefined) => void) =>
    start(async () => {
      const r = await fn();
      if (r.ok) { setError(null); onOk?.(r.data); } else setError(r.error);
    });
  return { pending, error, setError, run };
}
