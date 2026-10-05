'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { detectMapping, mapRows, parseCsv, type ColumnMapping, type ImportRow } from '@/lib/finance';
import { rateLimit } from '@/lib/rate-limit';
import { requireUser } from '../auth';
import { ServiceError } from '../finance/core';
import { addDividend, createInvestment, deleteDividend, deleteInvestment, updateInvestment, updatePrice } from '../finance/investments';
import { createAccount, createTransaction, deleteAccount, deleteTransaction, importTransactions, previewDuplicates, run, setBudget, shareAccount, unshareAccount, updateAccount, updateTransaction } from '../finance/service';
import { refreshPrices } from '../finance/quotes';
import { fail, type ActionResult } from './result';

const refresh = () => { revalidatePath('/finance'); revalidatePath('/investments'); revalidatePath('/dashboard'); };

/** Ejecuta una operación del servicio con el usuario autenticado y refresca las vistas afectadas. */
async function exec<T>(fn: (userId: string) => Promise<T>, limit?: { key: string; max: number; windowMs: number }): Promise<ActionResult<T>> {
  const user = await requireUser();
  if (limit && !rateLimit(`${limit.key}:${user.id}`, limit.max, limit.windowMs).ok) return fail('Demasiadas operaciones seguidas. Inténtalo en un momento.');
  const r = await run(() => fn(user.id));
  if (r.ok) refresh();
  return r.ok ? { ok: true, data: r.data } : r;
}

// Movimientos
export async function createTransactionAction(input: unknown) {
  return exec((u) => createTransaction(u, input));
}
export async function updateTransactionAction(id: string, input: unknown) {
  return exec((u) => updateTransaction(u, id, input));
}
export async function deleteTransactionAction(id: string) {
  return exec((u) => deleteTransaction(u, id));
}
// Cuentas
export async function createAccountAction(input: unknown) {
  return exec((u) => createAccount(u, input));
}
export async function updateAccountAction(id: string, input: unknown) {
  return exec((u) => updateAccount(u, id, input));
}
export async function deleteAccountAction(id: string) {
  return exec((u) => deleteAccount(u, id));
}
export async function shareAccountAction(input: unknown) {
  return exec((u) => shareAccount(u, input), { key: 'share', max: 10, windowMs: 3_600_000 });
}
export async function unshareAccountAction(id: string) {
  return exec((u) => unshareAccount(u, id));
}
// Presupuestos
export async function setBudgetAction(input: unknown) {
  return exec((u) => setBudget(u, input));
}
// Inversiones
export async function createInvestmentAction(input: unknown) {
  return exec((u) => createInvestment(u, input));
}
export async function updateInvestmentAction(id: string, input: unknown) {
  return exec((u) => updateInvestment(u, id, input));
}
export async function updatePriceAction(input: unknown) {
  return exec((u) => updatePrice(u, input));
}
export async function deleteInvestmentAction(id: string) {
  return exec((u) => deleteInvestment(u, id));
}
export async function addDividendAction(input: unknown) {
  return exec((u) => addDividend(u, input));
}
export async function deleteDividendAction(id: string) {
  return exec((u) => deleteDividend(u, id));
}

// Importación CSV
const MAX_CSV_CHARS = 1_000_000;
const mappingSchema = z.object({ date: z.number().int().min(0), description: z.number().int().min(0), amount: z.number().int().min(0).nullable(), debit: z.number().int().min(0).nullable(), credit: z.number().int().min(0).nullable() })
  .refine((m) => m.amount !== null || m.debit !== null || m.credit !== null, 'Elige la columna del importe');

export interface CsvPreview { header: string[]; mapping: ColumnMapping | null; rows: ImportRow[]; totalRows: number; delimiter: string; sample: string[][] }

/** Analiza el CSV en el servidor: columnas, importes, fechas, categorías sugeridas y duplicados. No guarda nada. */
export async function previewCsvAction(input: { accountId: string; text: string; mapping?: unknown }): Promise<ActionResult<CsvPreview>> {
  if (typeof input.text !== 'string' || input.text.length === 0) return fail('El archivo está vacío');
  if (input.text.length > MAX_CSV_CHARS) return fail('El archivo es demasiado grande (máximo 1 MB)');
  return exec(async (userId) => {
    const parsed = parseCsv(input.text);
    const [header, ...data] = parsed.rows;
    if (!header || data.length === 0) throw new ServiceError('El archivo no tiene filas de datos');
    if (data.length > 5000) throw new ServiceError('Máximo 5000 filas por importación');
    const given = input.mapping ? mappingSchema.safeParse(input.mapping) : null;
    const mapping = given?.success ? given.data : detectMapping(header);
    const sample = data.slice(0, 3);
    if (!mapping) return { header, mapping: null, rows: [], totalRows: data.length, delimiter: parsed.delimiter, sample };
    const rows = await previewDuplicates(userId, input.accountId, mapRows(data, mapping));
    return { header, mapping, rows, totalRows: data.length, delimiter: parsed.delimiter, sample };
  }, { key: 'csv-preview', max: 30, windowMs: 60_000 });
}

export async function importTransactionsAction(input: unknown) {
  return exec((u) => importTransactions(u, input), { key: 'csv-import', max: 20, windowMs: 600_000 });
}

/** Pide los precios actuales al mercado (Yahoo Finance) para todas las posiciones del usuario. */
export async function refreshPricesAction() {
  return exec((u) => refreshPrices(u), { key: 'quotes', max: 6, windowMs: 60_000 });
}
