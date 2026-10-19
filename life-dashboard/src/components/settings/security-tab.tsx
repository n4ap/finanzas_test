'use client';
import { Laptop, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Badge, Button, Card, Field, Input } from '@/components/ui/primitives';
import { useRun } from '@/components/ui/use-run';
import { changePasswordAction, revokeOtherSessionsAction, revokeSessionAction } from '@/server/actions/settings';
import type { SettingsData } from '@/server/settings/queries';

const when = (iso: string) => new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function SecurityTab({ sessions }: { sessions: SettingsData['sessions'] }) {
  const pw = useRun();
  const ss = useRun();
  const router = useRouter();
  const [done, setDone] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h2 className="mb-3 font-semibold">Cambiar contraseña</h2>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget; const f = new FormData(form);
          if (f.get('next') !== f.get('again')) { pw.setError('Las contraseñas nuevas no coinciden'); return; }
          pw.run(() => changePasswordAction({ current: String(f.get('current')), next: String(f.get('next')) }), (r) => { form.reset(); setDone(`Contraseña cambiada${r?.revoked ? ` y ${r.revoked} ${r.revoked === 1 ? 'sesión cerrada' : 'sesiones cerradas'}` : ''}.`); router.refresh(); });
        }}>
          <Field label="Contraseña actual" className="sm:col-span-2"><Input name="current" type="password" required autoComplete="current-password" /></Field>
          <Field label="Nueva contraseña (mín. 10 caracteres)"><Input name="next" type="password" required minLength={10} maxLength={200} autoComplete="new-password" /></Field>
          <Field label="Repite la nueva"><Input name="again" type="password" required minLength={10} maxLength={200} autoComplete="new-password" /></Field>
          {pw.error && <p role="alert" className="text-sm text-danger sm:col-span-2">{pw.error}</p>}
          {done && <p role="status" className="text-sm text-success sm:col-span-2">{done}</p>}
          <div className="sm:col-span-2"><Button type="submit" disabled={pw.pending}>{pw.pending ? 'Guardando…' : 'Cambiar contraseña'}</Button></div>
        </form>
      </Card>

      <Card className="p-5">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="mr-auto font-semibold">Sesiones abiertas</h2>
          <Button size="sm" variant="outline" disabled={ss.pending || sessions.length < 2} onClick={() => ss.run(() => revokeOtherSessionsAction(), () => router.refresh())}><LogOut size={14} /> Cerrar todas las demás</Button>
        </div>
        {ss.error && <p role="alert" className="text-sm text-danger">{ss.error}</p>}
        <ul className="divide-y">
          {sessions.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 py-3" data-session={s.current ? 'current' : 'other'}>
              <Laptop size={18} className="shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1"><p className="text-sm font-medium">{s.device} {s.current && <Badge tone="success">Esta sesión</Badge>}</p><p className="text-xs text-muted-foreground">Iniciada {when(s.createdAt)}{s.ip ? ` · IP ${s.ip}` : ''}</p></div>
              {!s.current && <Button size="sm" variant="outline" disabled={ss.pending} aria-label={`Cerrar la sesión de ${s.device}`} onClick={() => ss.run(() => revokeSessionAction(s.id), () => router.refresh())}>Cerrar</Button>}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-5 text-sm text-muted-foreground">
        <h2 className="mb-2 font-semibold text-foreground">Cómo se protegen tus datos</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Las contraseñas se guardan con scrypt (nunca en claro) y las sesiones con un identificador aleatorio del que solo se almacena su huella.</li>
          <li>Las claves de API y las direcciones de calendarios privados se guardan cifradas (AES-256-GCM).</li>
          <li>Intentos de acceso limitados, cabeceras de seguridad y comprobación de propietario en cada consulta.</li>
        </ul>
      </Card>
    </div>
  );
}
