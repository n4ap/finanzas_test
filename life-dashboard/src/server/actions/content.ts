'use server';
import { addSnapshot, createCompetitor, createContentPost, deleteCompetitor, deleteContentPost, deleteSnapshot, setContentKeywords, setContentStatus, updateCompetitor, updateContentPost } from '../life/content';
import { exec } from './exec';

const PATHS = ['/content', '/content/youtube', '/content/tiktok', '/content/calendar', '/content/analytics', '/content/competitors', '/content/news'];
export async function createContentPostAction(input: unknown) { return exec((u) => createContentPost(u, input), PATHS); }
export async function updateContentPostAction(id: string, input: unknown) { return exec((u) => updateContentPost(u, id, input), PATHS); }
export async function setContentStatusAction(id: string, status: string) { return exec((u) => setContentStatus(u, id, status), PATHS); }
export async function deleteContentPostAction(id: string) { return exec((u) => deleteContentPost(u, id), PATHS); }
export async function createCompetitorAction(input: unknown) { return exec((u) => createCompetitor(u, input), PATHS); }
export async function updateCompetitorAction(id: string, input: unknown) { return exec((u) => updateCompetitor(u, id, input), PATHS); }
export async function deleteCompetitorAction(id: string) { return exec((u) => deleteCompetitor(u, id), PATHS); }
export async function addSnapshotAction(competitorId: string, input: unknown) { return exec((u) => addSnapshot(u, competitorId, input), PATHS); }
export async function deleteSnapshotAction(id: string) { return exec((u) => deleteSnapshot(u, id), PATHS); }
export async function setContentKeywordsAction(input: unknown) { return exec((u) => setContentKeywords(u, input), PATHS); }
