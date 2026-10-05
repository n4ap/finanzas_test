'use client';
import { FileUp } from 'lucide-react';
import { useMemo, useRef, useState, useTransition } from 'react';
import { Badge, Button, Field, Select } from '@/components/ui/primitives';
import { ALL_CATEGORIES, categoryLabel, type ColumnMapping } from '@/lib/finance';
import { cn, formatEUR } from '@/lib/utils';
import { importTransactionsAction, previewCsvAction, type CsvPreview } from '@/server/actions/finance';
import type { AccountDTO } from './types';

const MAX_BYTES = 1_000_000;
const SHOWN = 300;

/** UTF-8 estricto; si el archivo no lo es (exportaciones de bancos antiguos), Windows-1252. */
function decode(buf: ArrayBuffer): string {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { return new TextDecoder('windows-1252').decode(buf); }
}

export function ImportTab({ accounts, defaultAccountId }: { accounts: AccountDTO[]; defaultAccountId?: string }) {
  const [accountId, setAccountId] = useState(defaultAccountId ?? accounts[0]?.id ?? '');
  const [text, setText] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [cats, setCats] = useState<Record<number, string>>({});
  const [manual, setManual] = useState<{ date: number; description: number; amount: number | ''; debit: number | ''; credit: number | '' }>({ date: 0, description: 1, amount: '', debit: '', credit: '' });
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  const reset = () => { setText(null); setFileName(''); setPreview(null); setPicked(new Set()); setCats({}); setError(null); if (input.current) input.current.value = ''; };

  const analyze = (t: string, mapping?: ColumnMapping) => start(async () => {
    const r = await previewCsvAction({ accountId, text: t, mapping });
    if (!r.ok) { setError(r.error); setPreview(null); return; }
    setError(null); setResult(null);
    setPreview(r.data!);
    setPicked(new Set(r.data!.rows.flatMap((row, i) => (!row.error && !row.duplicate ? [i] : []))));
    setCats({});
  });

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_BYTES) { setError('El archivo es demasiado grande (máximo 1 MB).'); return; }
    const t = decode(await file.arrayBuffer());
    setText(t); setFileName(file.name); setResult(null);
    analyze(t);
  };

  const rows = useMemo(() => preview?.rows ?? [], [preview]);
  const stats = useMemo(() => ({ valid: rows.filter((r) => !r.error).length, dup: rows.filter((r) => r.duplicate).length, bad: rows.filter((r) => r.error).length }), [rows]);
  const selected = rows.flatMap((r, i) => (picked.has(i) && !r.error ? [{ r, i }] : []));
  const total = selected.reduce((a, { r }) => a + (r.amount ?? 0), 0);

  const doImport = () => start(async () => {
    const res = await importTransactionsAction({
      accountId, skipDuplicates: !selected.some(({ r }) => r.duplicate),
      rows: selected.map(({ r, i }) => ({ date: r.date, amount: r.amount, description: r.description, category: cats[i] ?? r.category })),
    });
    if (res.ok) { setResult(res.data!); setPreview(null); setText(null); setFileName(''); if (input.current) input.current.value = ''; setError(null); } else setError(res.error);
  });

  if (accounts.length === 0) return <p className="text-sm text-muted-foreground">Crea primero una cuenta en la pestaña Cuentas.</p>;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field label="Importar en la cuenta"><Select value={accountId} onChange={(e) => { setAccountId(e.target.value); if (text) analyze(text); }}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
          <div>
            <input ref={input} id="csv-file" type="file" accept=".csv,.txt,text/csv" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
            <label htmlFor="csv-file" className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"><FileUp size={16} /> Elegir archivo CSV</label>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Admite separador «;» «,» o tabulador, fechas dd/mm/aaaa o aaaa-mm-dd e importes como 1.234,56. Primero se muestra una vista previa: no se guarda nada hasta que confirmes. Los movimientos que ya existen se detectan y se desmarcan.</p>
        {fileName && <p className="mt-2 text-sm">Archivo: <span className="font-medium">{fileName}</span> <button className="ml-2 text-xs text-primary hover:underline" onClick={reset}>Quitar</button></p>}
      </div>

      {pending && !preview && <p role="status" className="text-sm text-muted-foreground">Analizando archivo…</p>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {result && <p role="status" className="rounded-xl bg-success/10 p-3 text-sm text-success">Importados {result.imported} movimientos{result.skipped > 0 ? ` · ${result.skipped} omitidos por estar duplicados` : ''}. Ya aparecen en Movimientos y quedan en el historial de cambios.</p>}

      {preview && !preview.mapping && (
        <div className="space-y-3 rounded-2xl border bg-card p-4">
          <p className="text-sm font-medium">No he reconocido las columnas. Indícalas:</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {([['date', 'Fecha'], ['description', 'Concepto']] as const).map(([k, l]) => (
              <Field key={k} label={l}><Select value={manual[k]} onChange={(e) => setManual({ ...manual, [k]: Number(e.target.value) })}>{preview.header.map((h, i) => <option key={i} value={i}>{h || `Columna ${i + 1}`}</option>)}</Select></Field>
            ))}
            {([['amount', 'Importe (con signo)'], ['debit', 'Cargo (opcional)'], ['credit', 'Abono (opcional)']] as const).map(([k, l]) => (
              <Field key={k} label={l}><Select value={manual[k]} onChange={(e) => setManual({ ...manual, [k]: e.target.value === '' ? '' : Number(e.target.value) })}><option value="">—</option>{preview.header.map((h, i) => <option key={i} value={i}>{h || `Columna ${i + 1}`}</option>)}</Select></Field>
            ))}
          </div>
          <Button disabled={pending || (manual.amount === '' && manual.debit === '' && manual.credit === '')} onClick={() => text && analyze(text, { date: manual.date, description: manual.description, amount: manual.amount === '' ? null : manual.amount, debit: manual.debit === '' ? null : manual.debit, credit: manual.credit === '' ? null : manual.credit })}>Aplicar columnas</Button>
        </div>
      )}

      {preview?.mapping && (
        <section aria-label="Vista previa de la importación" className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge tone="success">{stats.valid - stats.dup} nuevas</Badge>
            {stats.dup > 0 && <Badge tone="important">{stats.dup} ya existentes</Badge>}
            {stats.bad > 0 && <Badge tone="urgent">{stats.bad} con errores</Badge>}
            <span className="text-muted-foreground">de {preview.totalRows} filas</span>
            <button className="ml-auto text-xs text-primary hover:underline" onClick={() => setPicked(new Set(rows.flatMap((r, i) => (!r.error && !r.duplicate ? [i] : []))))}>Solo nuevas</button>
            <button className="text-xs text-primary hover:underline" onClick={() => setPicked(new Set())}>Ninguna</button>
          </div>
          <div className="max-h-[28rem] overflow-auto rounded-2xl border bg-card">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground"><tr><th className="w-8 p-2"><span className="sr-only">Importar</span></th><th className="p-2 font-medium">Fecha</th><th className="p-2 font-medium">Concepto</th><th className="p-2 font-medium">Categoría</th><th className="p-2 text-right font-medium">Importe</th></tr></thead>
              <tbody>
                {rows.slice(0, SHOWN).map((r, i) => (
                  <tr key={i} className={cn('border-t', r.error && 'bg-danger/5', r.duplicate && 'text-muted-foreground')}>
                    <td className="p-2"><input type="checkbox" disabled={!!r.error} checked={picked.has(i)} aria-label={`Importar fila ${r.line}`} onChange={(e) => setPicked((p) => { const n = new Set(p); if (e.target.checked) n.add(i); else n.delete(i); return n; })} /></td>
                    <td className="whitespace-nowrap p-2">{r.date ?? '—'}</td>
                    <td className="max-w-56 truncate p-2">{r.description || '—'} {r.duplicate && <Badge tone="important">ya existe</Badge>} {r.error && <Badge tone="urgent">Línea {r.line}: {r.error}</Badge>}</td>
                    <td className="p-2">{r.error ? '' : <select aria-label={`Categoría de la fila ${r.line}`} className="rounded-lg border bg-card px-1.5 py-1 text-xs" value={cats[i] ?? r.category} onChange={(e) => setCats({ ...cats, [i]: e.target.value })}>{ALL_CATEGORIES.filter((c) => (c === 'ingresos') === ((r.amount ?? 0) > 0)).map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}</select>}</td>
                    <td className="whitespace-nowrap p-2 text-right tabular-nums">{r.amount !== null ? `${r.amount > 0 ? '+' : '−'}${formatEUR(Math.abs(r.amount), 2)}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > SHOWN && <p className="text-xs text-muted-foreground">Mostrando las primeras {SHOWN} de {rows.length}; la selección se aplica a todas.</p>}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">{selected.length} seleccionados · balance <span className="font-semibold tabular-nums">{total >= 0 ? '+' : '−'}{formatEUR(Math.abs(total), 2)}</span></p>
            <div className="flex gap-2"><Button variant="outline" onClick={reset}>Cancelar</Button><Button disabled={pending || selected.length === 0} onClick={doImport}>{pending ? 'Importando…' : `Importar ${selected.length} movimientos`}</Button></div>
          </div>
        </section>
      )}
    </div>
  );
}
