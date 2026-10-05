/** Cotizaciones: lógica pura (símbolos de Yahoo Finance y lectura de su respuesta). Sin red ni BD. */

export interface Quote { price: number; currency: string }

const EUROPEAN_SUFFIXES = ['.DE', '.MC', '.PA', '.AS', '.MI'] as const;

/** Candidatos de ticker de Yahoo para una posición, del más probable al menos. */
export function yahooCandidates(assetType: string, symbol: string): string[] {
  const s = symbol.trim().toUpperCase();
  if (!s) return [];
  if (assetType === 'crypto') return [s.includes('-') ? s : `${s}-EUR`];
  // Con sufijo de bolsa (VWCE.DE) o índice (^IBEX) el usuario ya eligió el ticker.
  if (s.includes('.') || s.startsWith('^')) return [s];
  return [s, ...EUROPEAN_SUFFIXES.map((x) => `${s}${x}`)];
}

/** Lee la respuesta de /v8/finance/chart. Devuelve null si no hay un precio utilizable. */
export function parseYahooChart(json: unknown): Quote | null {
  const meta = (json as { chart?: { result?: { meta?: { regularMarketPrice?: unknown; currency?: unknown } }[] } })?.chart?.result?.[0]?.meta;
  const price = meta?.regularMarketPrice;
  const currency = meta?.currency;
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0 || price >= 1e9) return null;
  if (typeof currency !== 'string' || !/^[A-Za-z]{3}$/.test(currency)) return null;
  return { price, currency };
}

/** Normaliza subunidades (peniques londinenses «GBp»/«GBX», agorot «ILA», céntimos sudafricanos «ZAc»). */
export function normalizeCurrency(q: Quote): Quote {
  if (q.currency === 'GBp' || q.currency === 'GBX') return { price: q.price / 100, currency: 'GBP' };
  if (q.currency === 'ZAc') return { price: q.price / 100, currency: 'ZAR' };
  if (q.currency === 'ILA') return { price: q.price / 100, currency: 'ILS' };
  return { price: q.price, currency: q.currency.toUpperCase() };
}

export const toEur = (q: Quote, rate: number) => Math.round(q.price * rate * 10_000) / 10_000;
export const fxSymbol = (currency: string) => `${currency.toUpperCase()}EUR=X`;
