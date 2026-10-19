import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { categoryLabel, csvText } from '@/lib/finance';
import { rateLimit } from '@/lib/rate-limit';
import { getCurrentUser } from '@/server/auth';
import { accessibleAccountsWhere } from '@/server/finance/core';

/** Exporta los movimientos de las cuentas accesibles (CSV con «;» y coma decimal para Excel en español). Campos de texto saneados contra inyección de fórmulas. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (!rateLimit(`export:${user.id}`, 10, 60_000).ok) return NextResponse.json({ error: 'Demasiadas exportaciones' }, { status: 429 });
  const month = new URL(req.url).searchParams.get('month');
  const m = month?.match(/^(\d{4})-(\d{2})$/);
  const range = m ? { gte: new Date(Date.UTC(+m[1]!, +m[2]! - 1, 1)), lt: new Date(Date.UTC(+m[1]!, +m[2]!, 1)) } : undefined;
  const rows = await db.transaction.findMany({
    where: { account: accessibleAccountsWhere(user.id), ...(range ? { date: range } : {}) },
    orderBy: { date: 'desc' }, include: { account: { select: { name: true } } }, take: 50_000,
  });
  const num = (d: { toString(): string }) => Number(d.toString()).toFixed(2).replace('.', ',');
  const lines = ['fecha;cuenta;concepto;categoria;importe', ...rows.map((t) => [t.date.toISOString().slice(0, 10), csvText(t.account.name), csvText(t.description), csvText(categoryLabel(t.category)), num(t.amount)].join(';'))];
  return new NextResponse('﻿' + lines.join('\r\n'), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="movimientos${month ? '-' + month : ''}.csv"`, 'Cache-Control': 'no-store' },
  });
}
