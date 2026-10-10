'use server';
import {
  createDecision, createGoal, deleteDecision, deleteGoal, goalActionToTask, priorityToTask, saveAnswers, saveReview, setGoalProgress, updateDecision, updateGoal,
} from '../coach/service';
import { exec } from './exec';

const PATHS = ['/coach', '/dashboard'];
const WITH_TASKS = [...PATHS, '/tasks', '/focus'];
export async function saveAnswersAction(input: unknown) { return exec((u) => saveAnswers(u, input), PATHS); }
export async function createGoalAction(input: unknown) { return exec((u) => createGoal(u, input), PATHS); }
export async function updateGoalAction(id: string, input: unknown) { return exec((u) => updateGoal(u, id, input), PATHS); }
export async function setGoalProgressAction(id: string, progress: number) { return exec((u) => setGoalProgress(u, id, progress), PATHS); }
export async function deleteGoalAction(id: string) { return exec((u) => deleteGoal(u, id), PATHS); }
export async function goalActionToTaskAction(id: string, dueKey?: string) { return exec((u) => goalActionToTask(u, id, dueKey), WITH_TASKS); }
export async function saveReviewAction(input: unknown) { return exec((u) => saveReview(u, input), PATHS); }
export async function priorityToTaskAction(title: string, dueKey: string) { return exec((u) => priorityToTask(u, title, dueKey), WITH_TASKS); }
export async function createDecisionAction(input: unknown) { return exec((u) => createDecision(u, input), PATHS); }
export async function updateDecisionAction(id: string, input: unknown) { return exec((u) => updateDecision(u, id, input), PATHS); }
export async function deleteDecisionAction(id: string) { return exec((u) => deleteDecision(u, id), PATHS); }
