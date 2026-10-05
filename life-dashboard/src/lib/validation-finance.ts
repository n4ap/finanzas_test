import { z } from 'zod';
import { ACCOUNT_KINDS, ALL_CATEGORIES, ASSET_TYPES, EXPENSE_IDS, INCOME_CATEGORY, toCents } from './finance';

const money = (max = 1_000_000_000) =>
  z.coerce.number().finite().refine((n) => Math.abs(n) <= max, 'Importe demasiado grande').refine((n) => Math.abs(toCents(n) - n * 100) < 1e-6, 'Máximo 2 decimales');
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha no válida').refine((s) => !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().startsWith(s), 'Fecha no válida');
const cuid = z.string().cuid();

export const transactionSchema = z
  .object({
    accountId: cuid,
    date: dateOnly,
    amount: money().refine((n) => n !== 0, 'El importe no puede ser 0'),
    category: z.enum(ALL_CATEGORIES),
    description: z.string().trim().min(1, 'Introduce un concepto').max(200),
    merchant: z.string().trim().max(100).optional(),
    recurring: z.boolean().default(false),
    upcoming: z.boolean().default(false),
  })
  .refine((t) => (t.category === INCOME_CATEGORY ? t.amount > 0 : t.amount < 0), { message: 'Los ingresos deben ser positivos y los gastos negativos', path: ['amount'] });
export type TransactionInput = z.input<typeof transactionSchema>;

export const importRowSchema = z.object({ date: dateOnly, amount: money().refine((n) => n !== 0), category: z.enum(ALL_CATEGORIES), description: z.string().trim().min(1).max(200) })
  .refine((t) => (t.category === INCOME_CATEGORY ? t.amount > 0 : t.amount < 0), { message: 'Categoría incoherente con el signo del importe' });
export const importSchema = z.object({ accountId: cuid, rows: z.array(z.unknown()).min(1, 'No hay filas que importar').max(5000, 'Máximo 5000 filas por importación'), skipDuplicates: z.boolean().default(true) });

export const accountSchema = z.object({
  name: z.string().trim().min(1, 'Introduce un nombre').max(60),
  kind: z.enum(ACCOUNT_KINDS.map((k) => k.id) as [string, ...string[]]),
  openingBalance: money().default(0),
});

export const budgetSchema = z.object({ category: z.enum(EXPENSE_IDS), monthly: money(1_000_000).refine((n) => n >= 0, 'No puede ser negativo') });

export const shareSchema = z.object({ accountId: cuid, email: z.string().trim().toLowerCase().email('Email no válido') });

export const investmentSchema = z.object({
  assetType: z.enum(ASSET_TYPES.map((a) => a.id) as [string, ...string[]]),
  symbol: z.string().trim().toUpperCase().min(1, 'Introduce un símbolo').max(20).regex(/^[A-Z0-9.\-:_]+$/, 'Símbolo no válido'),
  name: z.string().trim().min(1, 'Introduce un nombre').max(100),
  quantity: z.coerce.number().finite().gt(0, 'La cantidad debe ser mayor que 0').max(1e12),
  avgCost: z.coerce.number().finite().min(0).max(1e9),
  currentPrice: z.coerce.number().finite().min(0).max(1e9),
  dividendYield: z.coerce.number().finite().min(0).max(100).default(0),
});
export const dividendSchema = z.object({ investmentId: cuid, date: dateOnly, amount: money(1e8).refine((n) => n > 0, 'El dividendo debe ser positivo') });
export const priceSchema = z.object({ investmentId: cuid, currentPrice: z.coerce.number().finite().min(0).max(1e9) });
