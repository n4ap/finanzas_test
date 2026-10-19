import 'server-only';
import type { BankAccount, Prisma } from '@prisma/client';
import { db } from '@/lib/db';

export type Tx = Prisma.TransactionClient;

export class ServiceError extends Error {}
export const fail = (message: string): never => { throw new ServiceError(message); };

/** Cuentas a las que el usuario tiene acceso: propias o compartidas mediante un hogar del que es miembro. */
export const accessibleAccountsWhere = (userId: string): Prisma.BankAccountWhereInput => ({
  OR: [{ ownerId: userId }, { household: { members: { some: { userId } } } }],
});

export async function requireAccountAccess(client: Tx | typeof db, userId: string, accountId: string): Promise<BankAccount> {
  const acc = await client.bankAccount.findFirst({ where: { id: accountId, ...accessibleAccountsWhere(userId) } });
  return acc ?? fail('Cuenta no encontrada');
}

export async function requireAccountOwner(client: Tx | typeof db, userId: string, accountId: string): Promise<BankAccount> {
  const acc = await client.bankAccount.findFirst({ where: { id: accountId, ownerId: userId } });
  return acc ?? fail('Solo el propietario de la cuenta puede hacer esto');
}

/** Serializa un registro para auditoría (Decimal y Date → texto). */
export const snapshot = (row: object | null): Prisma.InputJsonValue | undefined =>
  row ? (JSON.parse(JSON.stringify(row)) as Prisma.InputJsonValue) : undefined;

export interface AuditEntry { userId: string; entity: 'Transaction' | 'BankAccount' | 'Budget' | 'Investment' | 'Dividend'; entityId: string; action: 'create' | 'update' | 'delete'; before?: object | null; after?: object | null }

/** Escribe la auditoría dentro de la MISMA transacción de BD que el cambio: o se guardan ambos o ninguno. */
export async function audit(tx: Tx, e: AuditEntry | AuditEntry[]) {
  const list = Array.isArray(e) ? e : [e];
  if (list.length === 0) return;
  await tx.auditLog.createMany({ data: list.map((x) => ({ userId: x.userId, entity: x.entity, entityId: x.entityId, action: x.action, before: snapshot(x.before ?? null), after: snapshot(x.after ?? null) })) });
}

export const toDate = (s: string) => new Date(`${s}T12:00:00.000Z`);
export const toNumber = (d: { toString(): string }) => Number(d.toString());
