'use server';
import { createContentPost, deleteContentPost, setContentStatus, updateContentPost } from '../life/content';
import { exec } from './exec';

const PATHS = ['/content'];
export async function createContentPostAction(input: unknown) { return exec((u) => createContentPost(u, input), PATHS); }
export async function updateContentPostAction(id: string, input: unknown) { return exec((u) => updateContentPost(u, id, input), PATHS); }
export async function setContentStatusAction(id: string, status: string) { return exec((u) => setContentStatus(u, id, status), PATHS); }
export async function deleteContentPostAction(id: string) { return exec((u) => deleteContentPost(u, id), PATHS); }
