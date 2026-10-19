'use client';
import { Check } from 'lucide-react';
import { useState } from 'react';
import { Meter } from '@/components/charts/bars';
import { Button, Card, Textarea } from '@/components/ui/primitives';
import { useRun } from '@/components/ui/use-run';
import { INTERVIEW } from '@/lib/coach';
import { cn } from '@/lib/utils';
import { saveAnswersAction } from '@/server/actions/coach';
import type { CoachData } from '@/server/coach/queries';
import type { CoachTab } from './types';

/** Entrevista inicial por bloques (5-8 preguntas) y «Mapa personal de vida» con las respuestas. */
export function InterviewTab({ d, go }: { d: CoachData; go: (t: CoachTab) => void }) {
  const first = d.interview.nextBlock === -1 ? null : d.interview.nextBlock;
  const [block, setBlock] = useState<number | null>(first);
  const [saved, setSaved] = useState<string | null>(null);
  const { pending, error, run } = useRun();
  const b = block === null ? null : INTERVIEW[block]!;
  const pct = d.interview.answered / d.interview.total;
  const quarterly = d.goals.filter((g) => g.level === 'quarterly' && g.status === 'active').length;

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
      <Card className="h-fit p-4">
        <h2 className="text-sm font-semibold">Entrevista inicial</h2>
        <p className="mb-2 text-xs text-muted-foreground">{d.interview.answered} de {d.interview.total} respuestas. Todas son opcionales: contesta con sinceridad, no con lo que «deberías».</p>
        <Meter pct={pct} status="ok" label={`Entrevista: ${Math.round(pct * 100)} %`} />
        <ol className="mt-3 space-y-1">
          {d.interview.blocks.map((x, i) => (
            <li key={x.id}>
              <button onClick={() => { setBlock(i); setSaved(null); }} aria-current={block === i ? 'step' : undefined}
                className={cn('flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm', block === i ? 'bg-muted font-medium' : 'hover:bg-muted/60')}>
                <span className={cn('grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px]', x.done && 'border-success bg-success text-white')}>{x.done ? <Check size={12} aria-hidden /> : i + 1}</span>
                <span className="mr-auto">{x.title}</span>
                <span className="text-xs text-muted-foreground">{x.answered}/{x.total}</span>
              </button>
            </li>
          ))}
          <li>
            <button onClick={() => setBlock(null)} aria-current={block === null ? 'step' : undefined} className={cn('mt-2 w-full rounded-lg px-2 py-1.5 text-left text-sm', block === null ? 'bg-muted font-medium' : 'hover:bg-muted/60')}>🗺️ Mi mapa de vida</button>
          </li>
        </ol>
      </Card>

      {b ? (
        <Card className="p-5">
          <p className="text-xs text-muted-foreground">Bloque {block! + 1} de {INTERVIEW.length}</p>
          <h2 className="mb-4 text-lg font-semibold">{b.title}</h2>
          <form key={b.id} className="space-y-4" onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const answers = Object.fromEntries(b.questions.map((q) => [q.key, String(f.get(q.key) ?? '')]));
            run(() => saveAnswersAction({ answers }), () => {
              setSaved(`Bloque «${b.title}» guardado.`);
              setBlock(block! + 1 < INTERVIEW.length ? block! + 1 : null);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            });
          }}>
            {b.questions.map((q, i) => (
              <label key={q.key} className="block">
                <span className="text-sm font-medium">{i + 1}. {q.text}</span>
                {q.hint && <span className="block text-xs text-muted-foreground">{q.hint}</span>}
                <Textarea name={q.key} defaultValue={d.answers[q.key] ?? ''} rows={2} maxLength={2000} className="mt-1" />
              </label>
            ))}
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <div className="flex flex-wrap justify-between gap-2">
              <Button type="button" variant="ghost" disabled={block === 0} onClick={() => setBlock(block! - 1)}>Anterior</Button>
              <Button type="submit" disabled={pending}>{pending ? 'Guardando…' : block! + 1 < INTERVIEW.length ? 'Guardar y seguir' : 'Guardar y ver mi mapa'}</Button>
            </div>
          </form>
        </Card>
      ) : (
        <div className="space-y-4">
          {saved && <p role="status" className="text-sm text-success">{saved}</p>}
          <Card className="p-5">
            <h2 className="text-lg font-semibold">🗺️ Mapa personal de vida</h2>
            <p className="text-sm text-muted-foreground">Tu perfil según tus respuestas. Se actualiza cada vez que editas un bloque.</p>
          </Card>
          {d.lifeMap.length === 0 ? (
            <Card className="p-5 text-sm text-muted-foreground">Aún no hay respuestas. <button className="text-primary hover:underline" onClick={() => setBlock(0)}>Empieza por el primer bloque</button>.</Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {d.lifeMap.map((a) => (
                <Card key={a.id} className="p-4">
                  <h3 className="mb-2 text-sm font-semibold"><span aria-hidden>{a.emoji}</span> {a.label}</h3>
                  <dl className="space-y-2 text-sm">
                    {a.items.map((x) => <div key={x.key}><dt className="text-xs text-muted-foreground">{x.question}</dt><dd className="whitespace-pre-line">{x.answer}</dd></div>)}
                  </dl>
                </Card>
              ))}
            </div>
          )}
          {d.interview.complete && (
            <Card className="flex flex-wrap items-center gap-3 border-primary/40 bg-primary/5 p-4">
              <p className="mr-auto text-sm">{quarterly === 0 ? <><strong>Siguiente paso:</strong> con este mapa, define tus <strong>3 objetivos más importantes para los próximos 90 días</strong>. Empieza por lo que más te importa (tu respuesta: «{d.answers.o_prioridad ?? d.answers.c_una ?? '—'}»).</> : `Tienes ${quarterly} ${quarterly === 1 ? 'objetivo' : 'objetivos'} de 90 días. Revísalos con este mapa delante: ¿encajan con lo que has escrito?`}</p>
              <Button onClick={() => go('objetivos')}>{quarterly === 0 ? 'Definir mis 3 objetivos' : 'Ver objetivos'}</Button>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
