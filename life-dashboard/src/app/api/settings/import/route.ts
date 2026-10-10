import { NextResponse } from 'next/server';
import { IMPORT_MAX_BYTES } from '@/lib/privacy-format';
import { rateLimit } from '@/lib/rate-limit';
import { getCurrentUser } from '@/server/auth';
import { ServiceError } from '@/server/life/core';
import { importUserData } from '@/server/settings/privacy';

/** Importa un archivo exportado (cuerpo = JSON). Añade datos; no borra nada. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (!rateLimit(`import:${user.id}`, 3, 10 * 60_000).ok) return NextResponse.json({ error: 'Demasiadas importaciones. Espera unos minutos.' }, { status: 429 });
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > IMPORT_MAX_BYTES) return NextResponse.json({ error: 'El archivo es demasiado grande' }, { status: 413 });
  const body = await req.text();
  try {
    return NextResponse.json(await importUserData(user.id, body));
  } catch (e) {
    if (e instanceof ServiceError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error('[import]', e);
    return NextResponse.json({ error: 'Error interno al importar' }, { status: 500 });
  }
}
