import { NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { getCurrentUser } from '@/server/auth';
import { exportUserData } from '@/server/settings/privacy';

/** Descarga de TODOS los datos propios en JSON. Solo con sesión; no se cachea. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (!rateLimit(`export:${user.id}`, 5, 3_600_000).ok) return NextResponse.json({ error: 'Demasiadas exportaciones. Inténtalo más tarde.' }, { status: 429 });
  const data = await exportUserData(user.id);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'content-disposition': `attachment; filename="life-dashboard-${new Date().toISOString().slice(0, 10)}.json"`, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
  });
}
