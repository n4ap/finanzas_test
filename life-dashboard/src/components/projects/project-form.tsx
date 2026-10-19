'use client';
import { useRouter } from 'next/navigation';
import { Dialog } from '@/components/ui/dialog';
import { Button, Field, Input, Select, Textarea } from '@/components/ui/primitives';
import { useRun } from '@/components/ui/use-run';
import { PRIORITY_LABEL, dateToDateOnly } from '@/lib/tasks';
import { PROJECT_COLORS, PROJECT_STATUSES, PROJECT_STATUS_LABEL } from '@/lib/projects';
import { createProjectAction, deleteProjectAction, updateProjectAction } from '@/server/actions/projects';
import type { ProjectDTO } from './types';

export function ProjectForm({ open, onClose, project }: { open: boolean; onClose: () => void; project?: ProjectDTO | null }) {
  const { pending, error, run } = useRun();
  const router = useRouter();
  const editing = !!project;
  return (
    <Dialog open={open} onClose={onClose} title={editing ? 'Editar proyecto' : 'Nuevo proyecto'}>
      <form key={project?.id ?? 'new'} className="space-y-3" onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const payload = { name: f.get('name'), description: f.get('description'), status: f.get('status'), priority: f.get('priority'), color: f.get('color'), targetDate: f.get('targetDate') };
        run(() => (editing ? updateProjectAction(project!.id, payload) : createProjectAction(payload)), () => onClose());
      }}>
        <Field label="Nombre"><Input name="name" required maxLength={80} defaultValue={project?.name} autoFocus /></Field>
        <Field label="Descripción"><Textarea name="description" maxLength={500} defaultValue={project?.description ?? ''} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Estado"><Select name="status" defaultValue={project?.status ?? 'active'}>{PROJECT_STATUSES.map((s) => <option key={s} value={s}>{PROJECT_STATUS_LABEL[s]}</option>)}</Select></Field>
          <Field label="Prioridad"><Select name="priority" defaultValue={project?.priority ?? 2}>{[1, 2, 3].map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}</Select></Field>
          <Field label="Fecha objetivo"><Input name="targetDate" type="date" defaultValue={dateToDateOnly(project?.targetDate ?? null)} /></Field>
          <Field label="Color"><Select name="color" defaultValue={project?.color ?? PROJECT_COLORS[0]}>{PROJECT_COLORS.map((c, i) => <option key={c} value={c}>Color {i + 1}</option>)}</Select></Field>
        </div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-between pt-2">
          {editing ? <Button type="button" variant="ghost" className="text-danger" disabled={pending} onClick={() => { if (confirm(`¿Eliminar «${project!.name}»? Sus tareas se conservan, pero quedarán sin proyecto.`)) run(() => deleteProjectAction(project!.id), () => { onClose(); router.push('/projects'); }); }}>Eliminar</Button> : <span />}
          <div className="flex gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Guardar'}</Button></div>
        </div>
      </form>
    </Dialog>
  );
}
