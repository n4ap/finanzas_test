'use client';
import { ArrowLeft, CheckCheck, ExternalLink, ListPlus, Sparkles, Star } from 'lucide-react';
import { useState, useTransition } from 'react';
import { Badge, Button, Card, Textarea } from '@/components/ui/primitives';
import { analyzeEmailAction, createTaskFromEmail, generateReplyDraft, setEmailFlag, suggestTasksFromEmail } from '@/server/actions/email';
import type { EmailDTO } from './types';

interface Suggestion { title: string; dueDate: string | null }
interface Draft { to: string; subject: string; body: string }

export function EmailDetail({ email, onBack }: { email: EmailDTO; onBack: () => void }) {
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const isInbox = email.folder === 'inbox';
  const deadline = email.deadline ? new Date(email.deadline) : null;

  const run = (fn: () => Promise<void>) => start(async () => { setMessage(null); await fn(); });

  return (
    <Card className="flex min-h-[60vh] flex-col overflow-hidden">
      <div className="flex items-start gap-2 border-b p-4">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onBack} aria-label="Volver a la lista"><ArrowLeft size={18} /></Button>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold leading-snug">{email.subject}</h2>
          <p className="text-sm text-muted-foreground">{email.folder === 'sent' ? `Para: ${email.toEmails.join(', ')}` : `${email.fromName} <${email.fromEmail}>`} · {new Date(email.receivedAt).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {email.category && <Badge tone="primary">{email.category}</Badge>}
            {email.needsReply && !email.replied && <Badge tone="important">Requiere respuesta</Badge>}
            {email.replied && <Badge tone="success">Respondido</Badge>}
            {deadline && <Badge tone="urgent">Antes del {deadline.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}</Badge>}
          </div>
        </div>
        <Button variant="ghost" size="icon" aria-pressed={email.starred} aria-label={email.starred ? 'Quitar destacado' : 'Destacar'} onClick={() => run(async () => { await setEmailFlag(email.id, 'starred', !email.starred); })}>
          <Star size={18} className={email.starred ? 'fill-warning text-warning' : ''} />
        </Button>
      </div>

      <div className="flex-1 space-y-4 p-4">
        {email.summary && (
          <div className="rounded-xl bg-primary/5 p-3 text-sm"><p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-primary"><Sparkles size={12} /> Resumen</p>{email.summary}</div>
        )}
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{email.body}</p>

        {suggestions && (
          <div className="rounded-xl border p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Tareas detectadas</p>
            {suggestions.length === 0 && <p className="text-sm text-muted-foreground">No se detectaron tareas.</p>}
            <ul className="space-y-2">{suggestions.map((s, i) => (
              <li key={i} className="flex items-center justify-between gap-2 text-sm">
                <span>{s.title}{s.dueDate && <span className="ml-2 text-xs text-muted-foreground">({s.dueDate})</span>}</span>
                <Button size="sm" variant="outline" disabled={pending} onClick={() => run(async () => { const r = await createTaskFromEmail(email.id, s); setMessage(r.ok ? 'Tarea creada' : r.error); if (r.ok) setSuggestions((cur) => cur?.filter((_, j) => j !== i) ?? null); })}>Añadir</Button>
              </li>
            ))}</ul>
          </div>
        )}

        {draft && (
          <div className="space-y-2 rounded-xl border p-3">
            <p className="text-xs font-medium text-muted-foreground">Borrador de respuesta · no se envía desde aquí</p>
            <p className="text-sm"><span className="text-muted-foreground">Para:</span> {draft.to} · <span className="text-muted-foreground">Asunto:</span> {draft.subject}</p>
            <Textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} className="min-h-40" aria-label="Texto del borrador" />
            <div className="flex flex-wrap gap-2">
              <a className="inline-flex h-8 items-center gap-2 rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90" href={`mailto:${encodeURIComponent(draft.to)}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`}><ExternalLink size={14} /> Abrir en mi cliente de correo</a>
              <Button size="sm" variant="outline" onClick={() => { void navigator.clipboard?.writeText(draft.body); setMessage('Copiado al portapapeles'); }}>Copiar</Button>
              <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>Descartar</Button>
            </div>
          </div>
        )}
        {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
      </div>

      {isInbox && (
        <div className="flex flex-wrap gap-2 border-t p-3">
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run(async () => { const r = await analyzeEmailAction(email.id); if (!r.ok) setMessage(r.error); })}><Sparkles size={14} /> {email.summary ? 'Volver a analizar' : 'Analizar'}</Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run(async () => { const r = await generateReplyDraft(email.id); if (r.ok && r.data) setDraft(r.data); else if (!r.ok) setMessage(r.error); })}>Redactar borrador</Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run(async () => { const r = await suggestTasksFromEmail(email.id); if (r.ok && r.data) setSuggestions(r.data); else if (!r.ok) setMessage(r.error); })}><ListPlus size={14} /> Extraer tareas</Button>
          {email.needsReply && !email.replied && <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(async () => { await setEmailFlag(email.id, 'replied', true); })}><CheckCheck size={14} /> Marcar respondido</Button>}
        </div>
      )}
    </Card>
  );
}
