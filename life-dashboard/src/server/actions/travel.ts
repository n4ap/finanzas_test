'use server';
import { addBooking, addDefaultPacking, addItineraryItem, addPackingItem, createTrip, deleteBooking, deleteItineraryItem, deletePackingItem, deleteTrip, setPacked, updateBooking, updateItineraryItem, updateTrip } from '../life/travel';
import { exec } from './exec';

const PATHS = ['/travel', '/dashboard'];
export async function createTripAction(input: unknown) { return exec((u) => createTrip(u, input), PATHS); }
export async function updateTripAction(id: string, input: unknown) { return exec((u) => updateTrip(u, id, input), PATHS); }
export async function deleteTripAction(id: string) { return exec((u) => deleteTrip(u, id), PATHS); }
export async function addBookingAction(tripId: string, input: unknown) { return exec((u) => addBooking(u, tripId, input), PATHS); }
export async function updateBookingAction(id: string, input: unknown) { return exec((u) => updateBooking(u, id, input), PATHS); }
export async function deleteBookingAction(id: string) { return exec((u) => deleteBooking(u, id), PATHS); }
export async function addItineraryAction(tripId: string, input: unknown) { return exec((u) => addItineraryItem(u, tripId, input), PATHS); }
export async function updateItineraryAction(id: string, input: unknown) { return exec((u) => updateItineraryItem(u, id, input), PATHS); }
export async function deleteItineraryAction(id: string) { return exec((u) => deleteItineraryItem(u, id), PATHS); }
export async function addPackingAction(tripId: string, input: unknown) { return exec((u) => addPackingItem(u, tripId, input), PATHS); }
export async function addDefaultPackingAction(tripId: string) { return exec((u) => addDefaultPacking(u, tripId), PATHS); }
export async function setPackedAction(id: string, packed: boolean) { return exec((u) => setPacked(u, id, packed), PATHS); }
export async function deletePackingAction(id: string) { return exec((u) => deletePackingItem(u, id), PATHS); }
