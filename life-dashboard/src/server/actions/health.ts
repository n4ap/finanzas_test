'use server';
import { completeWorkout, createWorkout, deleteMetric, deleteWorkout, saveMetric, setGoal, updateWorkout } from '../life/health';
import { exec } from './exec';

const PATHS = ['/health', '/dashboard'];
export async function saveMetricAction(input: unknown) { return exec((u) => saveMetric(u, input), PATHS); }
export async function deleteMetricAction(id: string) { return exec((u) => deleteMetric(u, id), PATHS); }
export async function createWorkoutAction(input: unknown) { return exec((u) => createWorkout(u, input), PATHS); }
export async function updateWorkoutAction(id: string, input: unknown) { return exec((u) => updateWorkout(u, id, input), PATHS); }
export async function completeWorkoutAction(id: string) { return exec((u) => completeWorkout(u, id), PATHS); }
export async function deleteWorkoutAction(id: string) { return exec((u) => deleteWorkout(u, id), PATHS); }
export async function setGoalAction(input: unknown) { return exec((u) => setGoal(u, input), PATHS); }
