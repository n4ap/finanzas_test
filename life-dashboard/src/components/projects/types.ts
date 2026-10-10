import type { ProjectStats } from '@/lib/projects';

export interface ProjectDTO {
  id: string; name: string; description: string | null; status: string; priority: number; color: string; targetDate: string | null;
  stats: ProjectStats;
}
