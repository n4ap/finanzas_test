import { describe, expect, it } from 'vitest';
import { parseFeed, stripHtml } from './feed';
import { checkUserUrl, isPublicIp, safeHttpUrl } from './net-guard';

const NOW = new Date('2026-10-05T06:00:00Z');

describe('parseFeed RSS', () => {
  const rss = `<?xml version="1.0"?><rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel>
    <title>Diario &amp; Co</title>
    <item><title><![CDATA[Nuevo modelo abierto]]></title><link>https://ejemplo.com/a</link><guid isPermaLink="false">id-1</guid>
      <description><![CDATA[<p>Resumen con <b>negrita</b> y &quot;comillas&quot;.</p><script>alert(1)</script>]]></description>
      <pubDate>Mon, 05 Oct 2026 05:00:00 GMT</pubDate><media:thumbnail url="https://ejemplo.com/i.jpg"/></item>
    <item><title>Enlace peligroso</title><link>javascript:alert(1)</link></item>
    <item><title>Sin enlace</title></item>
    <item><title>Futuro</title><link>https://ejemplo.com/f</link><pubDate>Mon, 05 Oct 2027 05:00:00 GMT</pubDate></item>
  </channel></rss>`;
  it('extrae título del feed, ítems válidos y limpia HTML', () => {
    const r = parseFeed(rss, NOW);
    expect(r.title).toBe('Diario & Co');
    expect(r.items.map((i) => i.title)).toEqual(['Nuevo modelo abierto', 'Futuro']);
    expect(r.items[0]).toMatchObject({ externalId: 'id-1', url: 'https://ejemplo.com/a', summary: 'Resumen con negrita y "comillas".', imageUrl: 'https://ejemplo.com/i.jpg' });
    expect(r.items[0]!.publishedAt.toISOString()).toBe('2026-10-05T05:00:00.000Z');
  });
  it('descarta enlaces no http(s) y fechas futuras absurdas', () => {
    const r = parseFeed(rss, NOW);
    expect(r.items.some((i) => /javascript/.test(i.url))).toBe(false);
    expect(r.items.find((i) => i.title === 'Futuro')!.publishedAt.getTime()).toBe(NOW.getTime());
  });
});

describe('parseFeed Atom', () => {
  const atom = `<feed xmlns="http://www.w3.org/2005/Atom"><title>Blog</title>
    <entry><title>Hola</title><link rel="self" href="https://ejemplo.com/self"/><link rel="alternate" href="https://ejemplo.com/hola"/><id>tag:ejemplo,2026:1</id>
      <updated>2026-10-04T10:00:00Z</updated><summary type="html">&lt;p&gt;Texto &amp;amp; más&lt;/p&gt;</summary></entry>
  </feed>`;
  it('usa el enlace alternate, el id y el resumen escapado', () => {
    const r = parseFeed(atom, NOW);
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).toMatchObject({ url: 'https://ejemplo.com/hola', externalId: 'tag:ejemplo,2026:1', summary: 'Texto & más' });
  });
});

describe('robustez', () => {
  it('XML roto, vacío o con DOCTYPE/entidades externas no revienta ni las resuelve', () => {
    expect(parseFeed('', NOW).items).toEqual([]);
    expect(parseFeed('<html><body>No soy un feed</body></html>', NOW).items).toEqual([]);
    const xxe = `<?xml version="1.0"?><!DOCTYPE r [<!ENTITY x SYSTEM "file:///etc/passwd">]><rss><channel><item><title>&x;</title><link>https://a.com/x</link></item></channel></rss>`;
    const r = parseFeed(xxe, NOW);
    expect(r.items[0]?.title ?? '').not.toMatch(/root:/);
  });
  it('limita el número de ítems', () => {
    const many = '<rss><channel>' + Array.from({ length: 200 }, (_, i) => `<item><title>T${i}</title><link>https://a.com/${i}</link></item>`).join('') + '</channel></rss>';
    expect(parseFeed(many, NOW).items).toHaveLength(50);
  });
  it('stripHtml', () => { expect(stripHtml('<b>a</b>&nbsp;&lt;i&gt;b&lt;/i&gt;<style>x{}</style>')).toBe('a b'); });
});

describe('net-guard', () => {
  it.each([
    ['127.0.0.1', false], ['10.1.2.3', false], ['172.16.0.1', false], ['172.32.0.1', true], ['192.168.1.1', false], ['169.254.169.254', false], ['100.64.0.1', false],
    ['0.0.0.0', false], ['224.0.0.1', false], ['8.8.8.8', true], ['93.184.216.34', true], ['::1', false], ['fe80::1', false], ['fd00::1', false],
    ['::ffff:127.0.0.1', false], ['::ffff:7f00:1', false], ['::ffff:8.8.8.8', true], ['2606:4700::1111', true], ['no-es-ip', false],
  ])('isPublicIp(%s) = %s', (ip, ok) => expect(isPublicIp(ip)).toBe(ok));
  it('checkUserUrl: esquemas, credenciales y hosts locales', () => {
    expect(checkUserUrl('https://ejemplo.com/cal.ics').ok).toBe(true);
    expect(checkUserUrl('webcal://ejemplo.com/cal.ics')).toMatchObject({ ok: true });
    for (const bad of ['file:///etc/passwd', 'ftp://a.com', 'javascript:alert(1)', 'https://user:pw@a.com', 'http://localhost/x', 'http://mi.local/x', 'no es url', 'http://srv.internal/x']) expect(checkUserUrl(bad).ok).toBe(false);
  });
  it('safeHttpUrl', () => { expect(safeHttpUrl('https://a.com/x')).toBe('https://a.com/x'); expect(safeHttpUrl('javascript:1')).toBeNull(); expect(safeHttpUrl('data:text/html,x')).toBeNull(); expect(safeHttpUrl(null)).toBeNull(); });
});
