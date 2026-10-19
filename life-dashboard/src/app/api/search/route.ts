import { NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';
import { getCurrentUser } from '@/server/auth';
import { globalSearch } from '@/server/search';

const querySchema = z.string().trim().min(2).max(80);

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  if (!rateLimit(`search:${user.id}`, 30, 10_000).ok) return NextResponse.json({ error: 'Demasiadas búsquedas' }, { status: 429 });
  const q = querySchema.safeParse(new URL(req.url).searchParams.get('q') ?? '');
  if (!q.success) return NextResponse.json({ hits: [] });
  return NextResponse.json({ hits: await globalSearch(user.id, q.data) });
}
