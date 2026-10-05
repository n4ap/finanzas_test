'use server';
import { addShopping, clearDoneShopping, createMember, deleteMember, deleteShopping, setShoppingDone, updateMember } from '../life/family';
import { exec } from './exec';

const PATHS = ['/family', '/dashboard'];
export async function createMemberAction(input: unknown) { return exec((u) => createMember(u, input), PATHS); }
export async function updateMemberAction(id: string, input: unknown) { return exec((u) => updateMember(u, id, input), PATHS); }
export async function deleteMemberAction(id: string) { return exec((u) => deleteMember(u, id), PATHS); }
export async function addShoppingAction(input: unknown) { return exec((u) => addShopping(u, input), PATHS); }
export async function setShoppingDoneAction(id: string, done: boolean) { return exec((u) => setShoppingDone(u, id, done), PATHS); }
export async function deleteShoppingAction(id: string) { return exec((u) => deleteShopping(u, id), PATHS); }
export async function clearDoneShoppingAction() { return exec((u) => clearDoneShopping(u), PATHS); }
