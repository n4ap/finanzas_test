'use client';
import { useState, useTransition } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button, Field, Input, Select, Textarea } from '@/components/ui/primitives';
import { PRIORITY_LABEL, RECURRENCE_LABEL, RECURRENCES, STATUS_LABEL, TASK_STATUSES, dateToDateOnly, parseTags } from '@/lib/tasks';
import { createTask, deleteTask, updateTask } from '@/server/actions/tasks';
import type { ProjectOption, TaskDTO } from './types';

const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

export function TaskForm({ open, onClose, task, parentId, projects, defaultDue, defaultProjectId }: { open: boolean; onClose: () => void; task?: TaskDTO | null; parentId?: string; projects: ProjectOption[]; defaultDue?: string; defaultProjectId?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const editing = !!task;

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const remind = String(f.get('remindAt') ?? '');
    const payload = {
      title: f.get('title'), description: f.get('description') || undefined, priority: f.get('priority'), status: f.get('status'),
      dueDate: f.get('dueDate'), estimateMinutes: f.get('estimateMinutes'), projectId: f.get('projectId'), parentId: parentId ?? task?.parentId ?? undefined,
      tags: parseTags(String(f.get('tags') ?? '')), recurrence: f.get('recurrence'), remindAt: remind ? new Date(remind).toISOString() : undefined,
    };
    start(async () => {
      const r = editing ? await updateTask(task!.id, payload) : await createTask(payload);
      if (r.ok) { setError(null); onClose(); } else setError(r.error);
    });
  };

  return (
    <Dialog open={open} onClose={onClose} title={editing ? 'Editar tarea' : parentId ? 'Nueva subtarea' : 'Nueva tarea'}>
      <form key={task?.id ?? 'new'} onSubmit={submit} className="space-y-3">
        <Field label="Título"><Input name="title" defaultValue={task?.title} required maxLength={200} autoFocus /></Field>
        <Field label="Descripción"><Textarea name="description" defaultValue={task?.description ?? ''} maxLength={2000} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prioridad"><Select name="priority" defaultValue={task?.priority ?? 2}>{[1, 2, 3].map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}</Select></Field>
          <Field label="Estado"><Select name="status" defaultValue={task?.status ?? 'inbox'}>{TASK_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</Select></Field>
          <Field label="Fecha límite"><Input name="dueDate" type="date" defaultValue={task ? dateToDateOnly(task.dueDate) : defaultDue ?? ''} /></Field>
          <Field label="Duración (min)"><Input name="estimateMinutes" type="number" min={1} max={1440} defaultValue={task?.estimateMinutes ?? ''} /></Field>
          <Field label="Proyecto"><Select name="projectId" defaultValue={task?.projectId ?? defaultProjectId ?? ''}><option value="">Sin proyecto</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
          <Field label="Repetir"><Select name="recurrence" defaultValue={task?.recurrence ?? ''}><option value="">No se repite</option>{RECURRENCES.map((r) => <option key={r} value={r}>{RECURRENCE_LABEL[r]}</option>)}</Select></Field>
          <Field label="Etiquetas"><Input name="tags" defaultValue={task?.tags.join(', ')} placeholder="dev, casa" /></Field>
          <Field label="Recordatorio"><Input name="remindAt" type="datetime-local" defaultValue={toLocalInput(task?.remindAt ?? null)} /></Field>
        </div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-between pt-2">
          {editing ? <Button type="button" variant="ghost" className="text-danger" disabled={pending} onClick={() => { if (confirm('¿Eliminar esta tarea y sus subtareas?')) start(async () => { const r = await deleteTask(task!.id); if (r.ok) onClose(); else setError(r.error); }); }}>Eliminar</Button> : <span />}
          <div className="flex gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Guardar'}</Button></div>
        </div>
      </form>
    </Dialog>
  );
}
