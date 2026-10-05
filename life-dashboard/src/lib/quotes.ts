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

/** ISIN válido: 2 letras de país, 9 alfanuméricos y dígito de control (Luhn sobre las letras convertidas a números). */
export function isValidIsin(raw: string): boolean {
  const s = raw.trim().toUpperCase();
  if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(s)) return false;
  const digits = [...s].map((c) => (/[A-Z]/.test(c) ? String(c.charCodeAt(0) - 55) : c)).join('');
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}

/** Tickers devueltos por /v1/finance/search para un ISIN, solo de fondos, ETF y acciones. */
export function parseYahooSearch(json: unknown): string[] {
  const quotes = (json as { quotes?: { symbol?: unknown; quoteType?: unknown }[] })?.quotes;
  if (!Array.isArray(quotes)) return [];
  const out: string[] = [];
  for (const q of quotes) {
    if (typeof q?.symbol !== 'string' || !/^[A-Za-z0-9.\-^=]{1,20}$/.test(q.symbol)) continue;
    if (typeof q.quoteType === 'string' && !['MUTUALFUND', 'ETF', 'EQUITY'].includes(q.quoteType)) continue;
    if (!out.includes(q.symbol)) out.push(q.symbol);
  }
  return out.slice(0, 5);
}
