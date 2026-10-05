import 'server-only';
import { db } from '@/lib/db';
import { fxSymbol, normalizeCurrency, parseYahooChart, parseYahooSearch, toEur, yahooCandidates, type Quote } from '@/lib/quotes';
import { safeFetchText } from '../integrations/safe-fetch';
import { audit, toNumber } from './core';
import { recordSnapshot } from './investments';

export type TextFetcher = (url: string, opts?: { maxBytes?: number; timeoutMs?: number; accept?: string; userAgent?: string }) => Promise<{ text: string }>;

export interface RefreshResult {
  updated: { symbol: string; ticker: string; price: number; previous: number }[];
  failed: { symbol: string; reason: string }[];
  at: string;
}

const MAX_POSITIONS = 100;
const BROWSER_UA = 'Mozilla/5.0 (compatible; LifeDashboard/1.0)';

async function chart(fetcher: TextFetcher, ticker: string): Promise<Quote | null> {
  try {
    const { text } = await fetcher(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1d&interval=1d`, { maxBytes: 500_000, timeoutMs: 8_000, accept: 'application/json', userAgent: BROWSER_UA });
    return parseYahooChart(JSON.parse(text));
  } catch { return null; }
}

async function searchIsin(fetcher: TextFetcher, isin: string): Promise<string[]> {
  try {
    const { text } = await fetcher(`https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(isin)}&quotesCount=6&newsCount=0`, { maxBytes: 500_000, timeoutMs: 8_000, accept: 'application/json', userAgent: BROWSER_UA });
    return parseYahooSearch(JSON.parse(text));
  } catch { return []; }
}

/**
 * Pide a Yahoo Finance el último precio de cada posición del usuario y lo guarda en euros.
 * Un valor que no se encuentra no detiene al resto. `fetcher` se inyecta para poder probarlo sin red.
 */
export async function refreshPrices(userId: string, fetcher: TextFetcher = safeFetchText): Promise<RefreshResult> {
  const positions = await db.investment.findMany({ where: { portfolio: { userId } }, orderBy: { symbol: 'asc' }, take: MAX_POSITIONS });
  const result: RefreshResult = { updated: [], failed: [], at: new Date().toISOString() };
  const fx = new Map<string, Promise<number | null>>();
  const rateFor = (currency: string) => {
    if (currency === 'EUR') return Promise.resolve(1);
    if (!fx.has(currency)) fx.set(currency, chart(fetcher, fxSymbol(currency)).then((q) => q?.price ?? null));
    return fx.get(currency)!;
  };

  const found = new Map<string, { ticker: string; eur: number }>();
  let next = 0;
  const worker = async () => {
    while (next < positions.length) {
      const inv = positions[next++]!;
      let reason = inv.isin ? `No se encontró el ISIN ${inv.isin}. Prueba con el ticker de Yahoo Finance en «Símbolo» (p. ej. VWCE.DE).` : 'No se encontró el valor. Añade el ISIN o usa el ticker de Yahoo Finance (p. ej. VWCE.DE).';
      // Orden: ticker ya resuelto → resultados de buscar el ISIN (se prefiere el que cotiza en euros) → símbolo escrito.
      const tried = new Set<string>();
      const attempt = async (ticker: string) => {
        if (tried.has(ticker)) return null;
        tried.add(ticker);
        const q = await chart(fetcher, ticker);
        return q ? { ticker, n: normalizeCurrency(q) } : null;
      };
      let best: { ticker: string; n: Quote } | null = null;
      if (inv.quoteSymbol) best = await attempt(inv.quoteSymbol);
      if (!best && inv.isin) {
        for (const ticker of await searchIsin(fetcher, inv.isin)) {
          const r = await attempt(ticker);
          if (!r) continue;
          if (!best) best = r;
          if (r.n.currency === 'EUR') { best = r; break; }
        }
      }
      if (!best) for (const ticker of yahooCandidates(inv.assetType, inv.symbol)) { best = await attempt(ticker); if (best) break; }
      if (best) {
        const rate = await rateFor(best.n.currency);
        if (rate === null) reason = `No se pudo convertir ${best.n.currency} a euros.`;
        else found.set(inv.id, { ticker: best.ticker, eur: toEur(best.n, rate) });
      }
      if (!found.has(inv.id)) result.failed.push({ symbol: inv.symbol, reason });
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  if (found.size === 0) return result;

  await db.$transaction(async (tx) => {
    const portfolios = new Set<string>();
    for (const inv of positions) {
      const hit = found.get(inv.id);
      if (!hit || hit.eur <= 0) continue;
      const previous = toNumber(inv.currentPrice);
      // Se recuerda el ticker hallado por ISIN para no volver a buscarlo.
      if (inv.isin && inv.quoteSymbol !== hit.ticker) await tx.investment.update({ where: { id: inv.id }, data: { quoteSymbol: hit.ticker } });
      if (previous !== hit.eur) {
        const after = await tx.investment.update({ where: { id: inv.id }, data: { currentPrice: hit.eur } });
        await audit(tx, { userId, entity: 'Investment', entityId: inv.id, action: 'update', before: inv, after });
        portfolios.add(inv.portfolioId);
      }
      result.updated.push({ symbol: inv.symbol, ticker: hit.ticker, price: hit.eur, previous });
    }
    for (const id of portfolios) await recordSnapshot(tx, id);
  });
  result.updated.sort((a, b) => a.symbol.localeCompare(b.symbol));
  return result;
}
