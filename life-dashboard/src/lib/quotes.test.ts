import { describe, expect, it } from 'vitest';
import { coingeckoId, parseCoingecko, fxSymbol, isValidIsin, normalizeCurrency, parseYahooChart, parseYahooSearch, toEur, yahooCandidates } from './quotes';

describe('yahooCandidates', () => {
  it('cripto: pareja en euros', () => { expect(yahooCandidates('crypto', 'btc')).toEqual(['BTC-EUR']); expect(yahooCandidates('crypto', 'ETH-USD')).toEqual(['ETH-USD']); });
  it('con sufijo de bolsa o índice respeta el ticker', () => { expect(yahooCandidates('etf', 'vwce.de')).toEqual(['VWCE.DE']); expect(yahooCandidates('stock', '^ibex')).toEqual(['^IBEX']); });
  it('sin sufijo prueba tal cual y luego bolsas europeas', () => { const c = yahooCandidates('etf', 'vwce'); expect(c[0]).toBe('VWCE'); expect(c).toContain('VWCE.DE'); });
  it('símbolo vacío → nada', () => expect(yahooCandidates('stock', '  ')).toEqual([]));
});

describe('parseYahooChart', () => {
  const ok = { chart: { result: [{ meta: { regularMarketPrice: 189.2, currency: 'USD' } }] } };
  it('lee precio y divisa', () => expect(parseYahooChart(ok)).toEqual({ price: 189.2, currency: 'USD' }));
  it.each([null, {}, { chart: { result: [] } }, { chart: { result: [{ meta: { regularMarketPrice: 0, currency: 'USD' } }] } },
    { chart: { result: [{ meta: { regularMarketPrice: '5', currency: 'USD' } }] } }, { chart: { result: [{ meta: { regularMarketPrice: 5, currency: 'DOLLARS' } }] } },
    { chart: { result: [{ meta: { regularMarketPrice: 1e12, currency: 'EUR' } }] } }])('rechaza respuestas inútiles %#', (j) => expect(parseYahooChart(j)).toBeNull());
});

describe('divisas', () => {
  it('peniques londinenses a libras', () => expect(normalizeCurrency({ price: 250, currency: 'GBp' })).toEqual({ price: 2.5, currency: 'GBP' }));
  it('convierte a euros con 4 decimales', () => expect(toEur({ price: 100, currency: 'USD' }, 0.9234567)).toBe(92.3457));
  it('símbolo de cambio', () => expect(fxSymbol('usd')).toBe('USDEUR=X'));
});

describe('isValidIsin', () => {
  it.each(['IE00BK5BQT80', 'US0378331005', 'ES0113900J37', 'ie00bk5bqt80'])('acepta %s', (i) => expect(isValidIsin(i)).toBe(true));
  it.each(['IE00BK5BQT81', 'US037833100', '1234567890AB', 'IE00BK5BQT8', ''])('rechaza %s', (i) => expect(isValidIsin(i)).toBe(false));
});

describe('parseYahooSearch', () => {
  it('devuelve tickers de fondos/ETF/acciones sin duplicados y descarta el resto', () => {
    const j = { quotes: [{ symbol: 'VWCE.DE', quoteType: 'ETF' }, { symbol: 'VWCE.DE', quoteType: 'ETF' }, { symbol: '0P0001', quoteType: 'MUTUALFUND' }, { symbol: 'XYZ=F', quoteType: 'FUTURE' }, { symbol: 'bad symbol', quoteType: 'ETF' }] };
    expect(parseYahooSearch(j)).toEqual(['VWCE.DE', '0P0001']);
  });
  it.each([null, {}, { quotes: 'x' }])('entrada inútil %#', (j) => expect(parseYahooSearch(j)).toEqual([]));
});

describe('CoinGecko', () => {
  it('id por símbolo, con o sin pareja', () => { expect(coingeckoId('btc')).toBe('bitcoin'); expect(coingeckoId('ETH-EUR')).toBe('ethereum'); expect(coingeckoId('RAROCOIN')).toBeNull(); });
  it('lee el precio en euros', () => { expect(parseCoingecko({ bitcoin: { eur: 60000 } }, 'bitcoin')).toBe(60000); expect(parseCoingecko({}, 'bitcoin')).toBeNull(); expect(parseCoingecko({ bitcoin: { eur: 0 } }, 'bitcoin')).toBeNull(); });
});
