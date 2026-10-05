'use client';
import { Download, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button, Card, Field, Input } from '@/components/ui/primitives';
import { useRun } from '@/components/ui/use-run';
import { deleteAccountAction, deleteDataAction } from '@/server/actions/settings';

export function DataTab({ email }: { email: string }) {
  const file = useRef<HTMLInputElement>(null);
  const [imp, setImp] = useState<{ busy: boolean; msg: string | null; err: string | null }>({ busy: false, msg: null, err: null });
  const del = useRun();
  const acc = useRun();
  const [wiped, setWiped] = useState(false);

  async function doImport() {
    const f = file.current?.files?.[0];
    if (!f) return;
    setImp({ busy: true, msg: null, err: null });
    try {
      const res = await fetch('/api/settings/import', { method: 'POST', headers: { 'content-type': 'application/json' }, body: await f.text() });
      const j = (await res.json()) as { error?: string; total?: number; counts?: Record<string, number> };
      if (!res.ok) setImp({ busy: false, msg: null, err: j.error ?? 'No se pudo importar' });
      else setImp({ busy: false, msg: `Importados ${j.total} elementos: ${Object.entries(j.counts ?? {}).map(([k, n]) => `${n} ${k}`).join(', ')}. Las automatizaciones importadas llegan desactivadas.`, err: null });
    } catch { setImp({ busy: false, msg: null, err: 'No se pudo leer o enviar el archivo' }); }
    if (file.current) file.current.value = '';
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h2 className="mb-1 font-semibold">Exportar mis datos</h2>
        <p className="mb-3 text-sm text-muted-foreground">Descarga todo lo tuyo (tareas, calendario, email, finanzas, inversiones, salud, viajes, familia, automatizaciones, conversaciones e historial de cambios) en un archivo JSON. No incluye contraseñas, sesiones ni claves.</p>
        <a href="/api/settings/export" download className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"><Download size={16} /> Descargar exportación</a>
      </Card>

      <Card className="p-5">
        <h2 className="mb-1 font-semibold">Importar datos</h2>
        <p className="mb-3 text-sm text-muted-foreground">Sube un archivo exportado desde Life Dashboard. Los datos se <strong>añaden</strong> a los que ya tienes (no se borra ni se pisa nada); importar dos veces el mismo archivo los duplica. Si algo falla, no se importa nada.</p>
        <div className="flex flex-wrap items-center gap-2">
          <input ref={file} type="file" accept="application/json,.json" aria-label="Archivo de exportación" className="text-sm file:mr-3 file:rounded-lg file:border file:bg-card file:px-3 file:py-1.5 file:text-sm" />
          <Button variant="outline" disabled={imp.busy} onClick={doImport}><Upload size={16} /> {imp.busy ? 'Importando…' : 'Importar'}</Button>
        </div>
        {imp.err && <p role="alert" className="mt-2 text-sm text-danger">{imp.err}</p>}
        {imp.msg && <p role="status" className="mt-2 text-sm text-success">{imp.msg}</p>}
      </Card>

      <Card className="border-danger/40 p-5">
        <h2 className="mb-1 flex items-center gap-2 font-semibold text-danger"><Trash2 size={16} aria-hidden /> Zona de peligro</h2>
        <div className="space-y-6">
          <form className="space-y-2" onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget; const pw = String(new FormData(form).get('password'));
            if (!confirm('Se borrarán TODOS tus datos (tareas, finanzas, salud, viajes…). Tu cuenta se conserva. Esta acción no se puede deshacer. ¿Continuar?')) return;
            del.run(() => deleteDataAction(pw), () => { form.reset(); setWiped(true); });
          }}>
            <h3 className="text-sm font-medium">Borrar todos mis datos</h3>
            <p className="text-sm text-muted-foreground">Elimina todo el contenido pero conserva tu cuenta y tu sesión. Las cuentas bancarias compartidas pasan a la otra persona. Se borra también tu historial de cambios financieros.</p>
            <div className="flex flex-wrap items-end gap-2"><Field label="Tu contraseña"><Input name="password" type="password" required autoComplete="current-password" /></Field><Button type="submit" variant="danger" disabled={del.pending}>Borrar mis datos</Button></div>
            {del.error && <p role="alert" className="text-sm text-danger">{del.error}</p>}
            {wiped && <p role="status" className="text-sm text-success">Tus datos se han borrado.</p>}
          </form>

          <form className="space-y-2 border-t pt-4" onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            if (!confirm('Se eliminará tu cuenta y TODOS tus datos de forma definitiva. ¿Seguro?')) return;
            acc.run(() => deleteAccountAction(String(f.get('password')), String(f.get('email'))));
          }}>
            <h3 className="text-sm font-medium">Eliminar mi cuenta</h3>
            <p className="text-sm text-muted-foreground">Borra tu cuenta y todo lo asociado, y cierra tu sesión. Si compartes una cuenta bancaria, la otra persona la conserva con todos sus movimientos. Escribe tu email ({email}) y tu contraseña para confirmar.</p>
            <div className="grid gap-2 sm:grid-cols-2"><Field label="Escribe tu email"><Input name="email" type="email" required autoComplete="off" /></Field><Field label="Tu contraseña"><Input name="password" type="password" required autoComplete="current-password" /></Field></div>
            <Button type="submit" variant="danger" disabled={acc.pending}>Eliminar mi cuenta definitivamente</Button>
            {acc.error && <p role="alert" className="text-sm text-danger">{acc.error}</p>}
          </form>
        </div>
      </Card>
    </div>
  );
}
