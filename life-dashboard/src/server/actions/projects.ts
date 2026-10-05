'use server';
import { createProject, deleteProject, updateProject } from '../life/projects';
import { exec } from './exec';

const PATHS = ['/projects', '/tasks', '/dashboard'];
export async function createProjectAction(input: unknown) { return exec((u) => createProject(u, input), PATHS); }
export async function updateProjectAction(id: string, input: unknown) { return exec((u) => updateProject(u, id, input), PATHS); }
export async function deleteProjectAction(id: string) { return exec((u) => deleteProject(u, id), PATHS); }
