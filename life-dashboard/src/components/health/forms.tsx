'use client';
import { Dialog } from '@/components/ui/dialog';
import { Button, Field, Input, Select, Textarea } from '@/components/ui/primitives';
import { useRun } from '@/components/ui/use-run';
import { GOAL_KINDS, GOAL_META, METRIC_KINDS, METRIC_META, WORKOUT_KINDS, WORKOUT_LABEL, type Goals } from '@/lib/health';
import { FileUp } from 'lucide-react';
import { useState } from 'react';
import { parseCsv } from '@/lib/finance';
import { parseHealthRows, type HealthImportResult } from '@/lib/health-import';
import { formatNumber } from '@/lib/utils';
import { readXlsx, XlsxError } from '@/lib/xlsx';
import { createWorkoutAction, deleteWorkoutAction, importHealthAction, saveMetricAction, setGoalAction, updateWorkoutAction } from '@/server/actions/health';

/** UTF-8 estricto; si no lo es, Windows-1252 (CSV guardados con Excel en español). */
const decodeText = (buf: ArrayBuffer) => { try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { return new TextDecoder('windows-1252').decode(buf); } };

const pad = (n: number) => String(n).padStart(2, '0');
export const todayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toLocalInput = (iso: string) => { const d = new Date(iso); return `${todayKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };

export interface WorkoutDTO { id: string; kind: string; title: string; date: string; minutes: number; calories: number | null; notes: string | null; planned: boolean }

export function MetricForm({ open, onClose, defaultKind = 'weight' }: { open: boolean; onClose: () => void; defaultKind?: string }) {
  const { pending, error, run } = useRun();
  const [kind, setKind] = useState(defaultKind);
  const meta = METRIC_META[kind as keyof typeof METRIC_META];
  return (
    <Dialog open={open} onClose={onClose} title="Registrar medición">
      <form className="space-y-3" onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        run(() => saveMetricAction({ kind, date: f.get('date'), value: String(f.get('value') ?? '').replace(',', '.') }), () => onClose());
      }}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo"><Select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Tipo de medición">{METRIC_KINDS.map((k) => <option key={k} value={k}>{METRIC_META[k].label}</option>)}</Select></Field>
          <Field label="Fecha"><Input name="date" type="date" required defaultValue={todayKey()} max={todayKey()} /></Field>
        </div>
        <Field label={`${meta.label} (${meta.unit})`}><Input name="value" inputMode="decimal" required autoFocus placeholder={kind === 'weight' ? '79,5' : kind === 'steps' ? '8500' : '7,5'} /></Field>
        <p className="text-xs text-muted-foreground">Si ya hay una medición manual de ese tipo y día, se sustituye.</p>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={pending}>Guardar</Button></div>
      </form>
    </Dialog>
  );
}

export function WorkoutForm({ open, onClose, workout }: { open: boolean; onClose: () => void; workout?: WorkoutDTO | null }) {
  const { pending, error, run } = useRun();
  const editing = !!workout;
  const dflt = () => { const d = new Date(); d.setMinutes(0, 0, 0); return toLocalInput(d.toISOString()); };
  return (
    <Dialog open={open} onClose={onClose} title={editing ? 'Editar entreno' : 'Nuevo entreno'}>
      <form key={workout?.id ?? 'new'} className="space-y-3" onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const when = String(f.get('date') ?? '');
        const payload = { kind: f.get('kind'), title: f.get('title'), date: when ? new Date(when).toISOString() : '', minutes: f.get('minutes'), calories: f.get('calories'), notes: f.get('notes'), planned: f.get('planned') === 'on' };
        run(() => (editing ? updateWorkoutAction(workout!.id, payload) : createWorkoutAction(payload)), () => onClose());
      }}>
        <Field label="Título"><Input name="title" required maxLength={100} defaultValue={workout?.title} autoFocus /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo"><Select name="kind" defaultValue={workout?.kind ?? 'gym'}>{WORKOUT_KINDS.map((k) => <option key={k} value={k}>{WORKOUT_LABEL[k]}</option>)}</Select></Field>
          <Field label="Fecha y hora"><Input name="date" type="datetime-local" required defaultValue={workout ? toLocalInput(workout.date) : dflt()} /></Field>
          <Field label="Duración (min)"><Input name="minutes" type="number" min={1} max={1440} required defaultValue={workout?.minutes ?? 60} /></Field>
          <Field label="Calorías (opcional)"><Input name="calories" type="number" min={0} max={20000} defaultValue={workout?.calories ?? ''} /></Field>
        </div>
        <Field label="Notas"><Textarea name="notes" maxLength={500} defaultValue={workout?.notes ?? ''} /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="planned" defaultChecked={workout?.planned ?? false} /> Planificado (aún no realizado)</label>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-between pt-2">
          {editing ? <Button type="button" variant="ghost" className="text-danger" disabled={pending} onClick={() => { if (confirm('¿Eliminar este entreno?')) run(() => deleteWorkoutAction(workout!.id), () => onClose()); }}>Eliminar</Button> : <span />}
          <div className="flex gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={pending}>Guardar</Button></div>
        </div>
      </form>
    </Dialog>
  );
}

export function GoalsForm({ open, onClose, goals }: { open: boolean; onClose: () => void; goals: Goals }) {
  const { pending, error, run } = useRun();
  return (
    <Dialog open={open} onClose={onClose} title="Mis metas">
      <form className="space-y-3" onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const changed = GOAL_KINDS.filter((k) => String(f.get(k) ?? '').trim() !== '' && Number(String(f.get(k)).replace(',', '.')) !== goals[k]);
        if (changed.length === 0) { onClose(); return; }
        run(async () => {
          for (const k of changed) {
            const r = await setGoalAction({ kind: k, target: String(f.get(k)).replace(',', '.') });
            if (!r.ok) return r;
          }
          return { ok: true as const };
        }, () => onClose());
      }}>
        <div className="grid grid-cols-2 gap-3">
          {GOAL_KINDS.map((k) => (
            <Field key={k} label={`${GOAL_META[k].label} (${GOAL_META[k].unit})`}><Input name={k} inputMode="decimal" defaultValue={goals[k] ?? ''} placeholder={k === 'weight' ? 'Sin meta' : undefined} /></Field>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Son metas orientativas tuyas, no recomendaciones médicas. Si tienes dudas sobre tu salud, consulta a un profesional.</p>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={pending}>Guardar</Button></div>
      </form>
    </Dialog>
  );
}

/** Importar pasos y sueño desde el archivo que exporta Garmin Connect (CSV o Excel). Se lee en el navegador; se guarda al confirmar. */
export function GarminImport({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { pending, error, run } = useRun();
  const [parsed, setParsed] = useState<HealthImportResult | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [done, setDone] = useState<{ steps: number; sleep: number } | null>(null);
  const reset = () => { setParsed(null); setFileError(null); setDone(null); };
  const close = () => { reset(); onClose(); };

  const onFile = async (file: File | undefined) => {
    reset();
    if (!file) return;
    if (file.size > 5_000_000) { setFileError('El archivo es demasiado grande (máximo 5 MB).'); return; }
    try {
      const buf = await file.arrayBuffer();
      const rows = /\.xlsx?$/i.test(file.name) ? await readXlsx(buf) : parseCsv(decodeText(buf)).rows;
      const r = parseHealthRows(rows);
      if (r.rows.length === 0) setFileError(r.columns ? 'No he encontrado días con datos válidos en el archivo.' : 'No he encontrado columnas de pasos ni de sueño. Exporta el informe de Pasos o de Sueño de Garmin Connect.');
      else setParsed(r);
    } catch (e) {
      setFileError(e instanceof XlsxError ? e.message : 'No he podido leer el archivo.');
    }
  };
  const fmtDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const sample = parsed?.rows.slice(-6).reverse() ?? [];

  return (
    <Dialog open={open} onClose={close} title="Importar pasos y sueño de Garmin">
      <div className="space-y-3 text-sm">
        <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
          <li>En el ordenador, entra en <strong>connect.garmin.com</strong>.</li>
          <li>Ve a <strong>Informes</strong> → <strong>Salud</strong> → <strong>Pasos</strong> (o <strong>Sueño</strong>) y elige el periodo (por ejemplo, 4 semanas).</li>
          <li>Pulsa <strong>Exportar</strong> y elige aquí el archivo descargado. Repite con el otro informe.</li>
        </ol>
        <div>
          <input id="garmin-file" type="file" accept=".csv,.xlsx,.xls,text/csv" className="sr-only" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
          <label htmlFor="garmin-file" className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"><FileUp size={16} aria-hidden /> Elegir archivo de Garmin</label>
        </div>
        {fileError && <p role="alert" className="text-danger">{fileError}</p>}
        {done && <p role="status" className="rounded-xl bg-success/10 p-3 text-success">Importados {done.steps} días de pasos y {done.sleep} noches de sueño. Ya aparecen en el resumen.</p>}
        {parsed && (
          <section aria-label="Vista previa de Garmin" className="space-y-2 rounded-xl border p-3">
            <p><strong>{parsed.steps}</strong> días de pasos · <strong>{parsed.sleep}</strong> noches de sueño{parsed.from && parsed.to ? ` · del ${fmtDate(parsed.from)} al ${fmtDate(parsed.to)}` : ''}</p>
            <p className="text-xs text-muted-foreground">Columnas usadas: fecha «{parsed.columns?.date}»{parsed.columns?.steps ? `, pasos «${parsed.columns.steps}»` : ''}{parsed.columns?.sleep ? `, sueño «${parsed.columns.sleep}»` : ''}{parsed.skipped > 0 ? ` · ${parsed.skipped} filas sin datos omitidas` : ''}</p>
            <ul className="text-xs tabular-nums">{sample.map((r) => <li key={`${r.kind}${r.date}`}>{fmtDate(r.date)} · {r.kind === 'steps' ? `${formatNumber(r.value)} pasos` : `${formatNumber(r.value, 1)} h de sueño`}</li>)}</ul>
            <p className="text-xs text-muted-foreground">Si ya había un dato de ese día (aunque lo apuntaras a mano), se sustituye por el de Garmin. Puedes importar el mismo archivo varias veces sin duplicar.</p>
          </section>
        )}
        {error && <p role="alert" className="text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={close}>{done ? 'Cerrar' : 'Cancelar'}</Button>
          {parsed && <Button disabled={pending} onClick={() => run(() => importHealthAction({ rows: parsed.rows }), (r) => { setParsed(null); setDone(r as { steps: number; sleep: number }); })}>{pending ? 'Importando…' : `Importar ${parsed.rows.length} datos`}</Button>}
        </div>
      </div>
    </Dialog>
  );
}
