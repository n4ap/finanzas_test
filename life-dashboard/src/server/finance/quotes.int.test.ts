import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { createInvestment, updateInvestment } from './investments';
import { refreshPrices, type TextFetcher } from './quotes';

let alice: string, bob: string;
const chartJson = (price: number, currency: string) => JSON.stringify({ chart: { result: [{ meta: { regularMarketPrice: price, currency } }] } });
/** Mercado simulado: ticker → [precio, divisa]. Lo demás responde 404 (como Yahoo con un ticker inexistente). */
const market = (m: Record<string, [number, string]>, calls: string[] = [], search: Record<string, string[]> = {}): TextFetcher => async (url) => {
  const sq = /search\?q=([A-Z0-9]+)/.exec(url);
  if (sq) { calls.push(`search:${sq[1]}`); return { text: JSON.stringify({ quotes: (search[sq[1]!] ?? []).map((symbol) => ({ symbol, quoteType: 'ETF' })) }) }; }
  const t = decodeURIComponent(/chart\/([^?]+)/.exec(url)![1]!);
  calls.push(t);
  const hit = m[t];
  if (!hit) throw new Error('404');
  return { text: chartJson(hit[0], hit[1]) };
};
const price = async (symbol: string, userId = alice) => Number((await db.investment.findFirstOrThrow({ where: { symbol, portfolio: { userId } } })).currentPrice);
const pos = (symbol: string, o: Record<string, unknown> = {}) => ({ assetType: 'stock', symbol, name: symbol, quantity: 2, avgCost: 100, currentPrice: 100, dividendYield: 0, ...o });

beforeEach(async () => {
  await db.user.deleteMany();
  const mk = (n: string) => db.user.create({ data: { email: `${n}@test.dev`, name: n, passwordHash: 'x' } }).then((u) => u.id);
  [alice, bob] = [await mk('alice'), await mk('bob')];
});

describe('refreshPrices', () => {
  it('actualiza en euros, convierte divisas y deja auditoría e instantánea', async () => {
    await createInvestment(alice, pos('AAPL'));
    await createInvestment(alice, pos('BTC', { assetType: 'crypto' }));
    await createInvestment(alice, pos('SAN.MC'));
    const r = await refreshPrices(alice, market({ AAPL: [200, 'USD'], 'USDEUR=X': [0.9, 'EUR'], 'BTC-EUR': [60000, 'EUR'], 'SAN.MC': [4.5, 'EUR'] }));
    expect(r.failed).toEqual([]);
    expect(await price('AAPL')).toBe(180);
    expect(await price('BTC')).toBe(60000);
    expect(await price('SAN.MC')).toBe(4.5);
    expect(await db.auditLog.count({ where: { userId: alice, entity: 'Investment', action: 'update' } })).toBe(3);
    const snap = await db.portfolioSnapshot.findFirstOrThrow({ where: { portfolio: { userId: alice } }, orderBy: { date: 'desc' } });
    expect(Number(snap.value)).toBe(2 * 180 + 2 * 60000 + 2 * 4.5);
  });
  it('un valor sin precio no detiene al resto y se informa', async () => {
    await createInvestment(alice, pos('AAPL'));
    await createInvestment(alice, pos('NOEXISTE'));
    const r = await refreshPrices(alice, market({ AAPL: [10, 'EUR'] }));
    expect(r.updated.map((u) => u.symbol)).toEqual(['AAPL']);
    expect(r.failed).toHaveLength(1);
    expect(r.failed[0]).toMatchObject({ symbol: 'NOEXISTE' });
    expect(await price('NOEXISTE')).toBe(100);
  });
  it('prueba la bolsa alemana cuando el ticker sin sufijo no existe (VWCE → VWCE.DE)', async () => {
    await createInvestment(alice, pos('VWCE', { assetType: 'etf' }));
    const calls: string[] = [];
    const r = await refreshPrices(alice, market({ 'VWCE.DE': [120.5, 'EUR'] }, calls));
    expect(r.updated[0]).toMatchObject({ symbol: 'VWCE', ticker: 'VWCE.DE', price: 120.5 });
    expect(calls.slice(0, 2)).toEqual(['VWCE', 'VWCE.DE']);
  });
  it('sin tipo de cambio no actualiza esa posición', async () => {
    await createInvestment(alice, pos('AAPL'));
    const r = await refreshPrices(alice, market({ AAPL: [200, 'USD'] }));
    expect(r.updated).toEqual([]);
    expect(r.failed[0]!.reason).toMatch(/convertir USD/);
    expect(await price('AAPL')).toBe(100);
  });
  it('solo toca las posiciones del propio usuario', async () => {
    await createInvestment(alice, pos('AAPL'));
    await createInvestment(bob, pos('AAPL'));
    await refreshPrices(alice, market({ AAPL: [50, 'EUR'] }));
    expect(await price('AAPL', alice)).toBe(50);
    expect(await price('AAPL', bob)).toBe(100);
  });
  it('si el precio no cambia no genera auditoría', async () => {
    await createInvestment(alice, pos('AAPL'));
    await refreshPrices(alice, market({ AAPL: [100, 'EUR'] }));
    expect(await db.auditLog.count({ where: { userId: alice, entity: 'Investment', action: 'update' } })).toBe(0);
  });
  it('sin posiciones devuelve vacío', async () => {
    expect(await refreshPrices(alice, market({}))).toMatchObject({ updated: [], failed: [] });
  });

  it('con ISIN busca el fondo, prefiere el ticker en euros y lo recuerda', async () => {
    const id = await createInvestment(alice, pos('MIFONDO', { assetType: 'fund', isin: 'IE00BK5BQT80' }));
    const calls: string[] = [];
    const m = market({ VWRA: [140, 'USD'], 'VWCE.DE': [120.5, 'EUR'], 'USDEUR=X': [0.9, 'EUR'] }, calls, { IE00BK5BQT80: ['VWRA', 'VWCE.DE'] });
    const r = await refreshPrices(alice, m);
    expect(r.updated[0]).toMatchObject({ symbol: 'MIFONDO', ticker: 'VWCE.DE', price: 120.5 });
    expect((await db.investment.findUniqueOrThrow({ where: { id } })).quoteSymbol).toBe('VWCE.DE');
    calls.length = 0;
    await refreshPrices(alice, m);
    expect(calls).not.toContain('search:IE00BK5BQT80'); // ya no vuelve a buscar
  });
  it('si cambia el ISIN o el símbolo se olvida el ticker guardado', async () => {
    const id = await createInvestment(alice, pos('MIFONDO', { assetType: 'fund', isin: 'IE00BK5BQT80' }));
    await db.investment.update({ where: { id }, data: { quoteSymbol: 'VIEJO' } });
    await updateInvestment(alice, id, pos('MIFONDO', { assetType: 'fund', isin: 'US0378331005' }));
    expect((await db.investment.findUniqueOrThrow({ where: { id } })).quoteSymbol).toBeNull();
    expect((await db.investment.findUniqueOrThrow({ where: { id } })).isin).toBe('US0378331005');
  });
  it('rechaza un ISIN con dígito de control incorrecto y acepta vacío', async () => {
    await expect(createInvestment(alice, pos('X', { isin: 'IE00BK5BQT81' }))).rejects.toThrow(/ISIN/);
    const id = await createInvestment(alice, pos('Y', { isin: '' }));
    expect((await db.investment.findUniqueOrThrow({ where: { id } })).isin).toBeNull();
  });
});
