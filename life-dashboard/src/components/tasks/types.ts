import type { TaskStatus } from '@/lib/tasks';

export interface TaskDTO {
  id: string; title: string; description: string | null; priority: number; status: TaskStatus;
  dueDate: string | null; estimateMinutes: number | null; projectId: string | null; projectName: string | null; projectColor: string | null;
  parentId: string | null; tags: string[]; recurrence: string | null; remindAt: string | null; completedAt: string | null;
}
export interface ProjectOption { id: string; name: string; color: string }
