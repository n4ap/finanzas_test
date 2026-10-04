/** Rate limiter de ventana deslizante en memoria (suficiente para una instancia; sustituir por Redis al escalar). */
const buckets = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): { ok: boolean; retryAfterMs: number } {
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return { ok: false, retryAfterMs: windowMs - (now - (hits[0] ?? now)) };
  }
  hits.push(now);
  buckets.set(key, hits);
  return { ok: true, retryAfterMs: 0 };
}

export const resetRateLimit = () => buckets.clear();
