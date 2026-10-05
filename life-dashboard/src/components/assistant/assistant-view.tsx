'use client';
import { Bot, Lightbulb, MessageSquarePlus, Send, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Badge, Button, Card } from '@/components/ui/primitives';
import { useRun } from '@/components/ui/use-run';
import { cn } from '@/lib/utils';
import { deleteConversationAction, sendMessageAction } from '@/server/actions/ai';
import type { AssistantData } from '@/server/ai/queries';
import type { Recommendation } from '@/server/ai/recommendations';
import { ProposalCard } from './proposal-card';
import { RichText } from './rich-text';

const SAMPLES = ['¿Qué tengo mañana?', 'Tareas atrasadas', '¿Cuánto he gastado este mes?', 'Organízame la semana', 'Crea una tarea llamar al dentista el viernes', 'Añade leche y pan a la compra'];
const TONE = { urgent: 'urgent', important: 'important', info: 'neutral' } as const;

export function AssistantView({ d, recommendations, initialQuery }: { d: AssistantData; recommendations: Recommendation[]; initialQuery?: string }) {
  const router = useRouter();
  const { pending, error, setError, run } = useRun();
  const [text, setText] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  const send = (msg: string) => {
    const t = msg.trim();
    if (!t || pending) return;
    setSent(t); setText('');
    run(() => sendMessageAction({ conversationId: d.current, text: t, tzOffset: new Date().getTimezoneOffset() }), (r) => {
      router.replace(`/assistant?c=${r!.conversationId}`);
      router.refresh();
    });
  };
  // Enlace desde el widget del dashboard (?q=…): se envía una sola vez.
  useEffect(() => {
    if (initialQuery && !started.current && !d.current) { started.current = true; send(initialQuery); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (!pending) setSent(null); }, [pending, d.messages.length]);
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'end' }); }, [d.messages.length, sent]);

  const empty = d.messages.length === 0 && !sent;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="space-y-3" aria-label="Conversaciones">
        <Button className="w-full" variant="outline" onClick={() => { setError(null); router.push('/assistant'); }}><MessageSquarePlus size={16} /> Nueva conversación</Button>
        {d.pending.length > 0 && (
          <Link href="/automations" className="flex items-center justify-between rounded-xl bg-primary/10 px-3 py-2 text-sm text-primary hover:bg-primary/15">
            <span>Pendientes de confirmar</span><Badge tone="primary">{d.pending.length}</Badge>
          </Link>
        )}
        <ul className="max-h-64 space-y-1 overflow-y-auto md:max-h-[60vh]">
          {d.conversations.map((c) => (
            <li key={c.id} className="group flex items-center gap-1">
              <Link href={`/assistant?c=${c.id}`} aria-current={c.id === d.current ? 'page' : undefined} className={cn('min-w-0 flex-1 truncate rounded-lg px-3 py-2 text-sm hover:bg-muted', c.id === d.current && 'bg-muted font-medium')}>{c.title}</Link>
              <button aria-label={`Eliminar conversación «${c.title}»`} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-danger" onClick={() => { if (confirm('¿Eliminar esta conversación?')) run(() => deleteConversationAction(c.id), () => { if (c.id === d.current) router.replace('/assistant'); router.refresh(); }); }}><Trash2 size={14} /></button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="flex min-h-[60vh] flex-col" aria-label="Conversación">
        <p className="mb-3 rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          Asistente local basado en reglas (no es un modelo de lenguaje): consulta tus datos con herramientas internas y <strong>tus datos no salen del servidor</strong>. Cualquier acción que cree o cambie algo te pedirá confirmación.
        </p>
        <div className="flex-1 space-y-3" aria-live="polite">
          {empty && (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-1 py-4 text-center"><Bot size={30} className="text-primary" aria-hidden /><p className="font-medium">¿En qué te ayudo?</p></div>
              {recommendations.length > 0 && (
                <Card className="p-4">
                  <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Lightbulb size={15} aria-hidden /> Recomendaciones para ti</h2>
                  <ul className="divide-y">
                    {recommendations.map((r) => (
                      <li key={r.id} className="flex items-start gap-3 py-2">
                        <Badge tone={TONE[r.tone]} className="mt-0.5">{r.tone === 'urgent' ? 'Urgente' : r.tone === 'important' ? 'Importante' : 'Consejo'}</Badge>
                        <div className="min-w-0 flex-1"><p className="text-sm font-medium">{r.title}</p><p className="text-xs text-muted-foreground">{r.detail}</p></div>
                        {r.ask ? <Button size="sm" variant="outline" onClick={() => send(r.ask!)}>Preguntar</Button> : r.href ? <Link href={r.href} className="shrink-0 text-xs text-primary hover:underline">Ver</Link> : null}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
              <ul className="flex flex-wrap justify-center gap-2" aria-label="Ejemplos">
                {SAMPLES.map((s) => <li key={s}><button className="rounded-full border px-3 py-1.5 text-sm hover:bg-muted" onClick={() => send(s)}>{s}</button></li>)}
              </ul>
            </div>
          )}
          {d.messages.map((m) => (
            <div key={m.id} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[92%] rounded-2xl px-4 py-2.5 sm:max-w-[80%]', m.role === 'user' ? 'bg-primary text-primary-foreground' : 'border bg-card')} data-role={m.role}>
                {m.role === 'user' ? <p className="whitespace-pre-wrap text-sm">{m.content}</p> : <RichText text={m.content} />}
                {m.proposals.map((p) => <ProposalCard key={p.id} p={p} />)}
              </div>
            </div>
          ))}
          {sent && (
            <>
              <div className="flex justify-end"><div className="max-w-[80%] rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground opacity-70"><p className="whitespace-pre-wrap">{sent}</p></div></div>
              <p className="text-xs text-muted-foreground" role="status">Consultando tus datos…</p>
            </>
          )}
          <div ref={bottom} className="h-px scroll-mb-28" />
        </div>
        {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
        <form className="sticky bottom-16 mt-3 flex gap-2 bg-background py-2 md:bottom-0" onSubmit={(e) => { e.preventDefault(); send(text); }}>
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} aria-label="Mensaje para el asistente" placeholder="Pregunta o pide algo…" disabled={pending} autoComplete="off"
            className="h-11 flex-1 rounded-xl border bg-card px-4 text-sm placeholder:text-muted-foreground disabled:opacity-60" />
          <Button type="submit" size="icon" className="h-11 w-11" disabled={pending || !text.trim()} aria-label="Enviar"><Send size={16} /></Button>
        </form>
      </section>
    </div>
  );
}
