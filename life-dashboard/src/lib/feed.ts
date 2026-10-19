import { safeHttpUrl } from './net-guard';

/**
 * Lector mínimo de RSS 2.0 y Atom, sin dependencias y SIN procesar DTD/entidades externas (no hay XXE posible:
 * es extracción de texto por patrones). El contenido de un feed es dato no confiable: se limpia de etiquetas HTML,
 * y solo se conservan enlaces http(s).
 */
export interface FeedItem { externalId: string; title: string; url: string; summary: string; imageUrl: string | null; publishedAt: Date }
export interface FeedResult { title: string | null; items: FeedItem[] }

const MAX_ITEMS = 50;
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', ndash: '–', mdash: '—', laquo: '«', raquo: '»', aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Ntilde: 'Ñ', uuml: 'ü', iexcl: '¡', iquest: '¿' };

const decode = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
  if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ''; }
  return ENTITIES[e] ?? m;
});
const cdata = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_m, c: string) => c);
const strip1 = (s: string) => decode(cdata(s).replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
/** Texto plano: quita etiquetas (y su contenido en script/style), decodifica entidades y colapsa espacios. Segunda pasada si tras decodificar aparece HTML (Atom type="html" viene escapado). */
export const stripHtml = (s: string) => { const out = strip1(s); return /<\/?[a-z][^>]*>/i.test(out) ? strip1(out) : out; };

const tag = (block: string, name: string) => {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i').exec(block);
  return m ? m[1]! : null;
};
const attr = (block: string, tagName: string, attrName: string, filter?: (attrs: string) => boolean) => {
  for (const m of block.matchAll(new RegExp(`<${tagName}\\b([^>]*)/?>`, 'gi'))) {
    if (filter && !filter(m[1]!)) continue;
    const a = new RegExp(`${attrName}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i').exec(m[1]!);
    if (a) return decode(a[2] ?? a[3] ?? '');
  }
  return null;
};

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(decode(cdata(s)).trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseFeed(xml: string, now = new Date()): FeedResult {
  const text = xml.replace(/<\?xml[\s\S]*?\?>/, '').replace(/<!DOCTYPE[\s\S]*?(\]>|>)/i, '').replace(/<!--[\s\S]*?-->/g, '');
  const isAtom = /<feed[\s>]/i.test(text) && !/<rss[\s>]/i.test(text);
  const blocks = [...text.matchAll(isAtom ? /<entry[\s>][\s\S]*?<\/entry>/gi : /<item[\s>][\s\S]*?<\/item>/gi)].map((m) => m[0]);
  const head = text.slice(0, Math.max(0, text.search(isAtom ? /<entry[\s>]/i : /<item[\s>]/i)) || undefined);
  const titleRaw = tag(head, 'title');
  const items: FeedItem[] = [];
  for (const b of blocks.slice(0, MAX_ITEMS)) {
    const title = stripHtml(tag(b, 'title') ?? '').slice(0, 200);
    const link = isAtom ? (attr(b, 'link', 'href', (a) => !/rel\s*=\s*["'](?!alternate)/i.test(a)) ?? '') : stripHtml(tag(b, 'link') ?? '');
    const url = safeHttpUrl(link);
    if (!title || !url) continue;
    const summaryRaw = tag(b, isAtom ? 'summary' : 'description') ?? tag(b, 'content:encoded') ?? tag(b, 'content') ?? '';
    const summary = stripHtml(summaryRaw).slice(0, 500);
    const date = parseDate(tag(b, isAtom ? 'published' : 'pubDate') ?? tag(b, 'updated') ?? tag(b, 'dc:date')) ?? now;
    const image = safeHttpUrl(attr(b, 'media:thumbnail', 'url') ?? attr(b, 'media:content', 'url') ?? attr(b, 'enclosure', 'url', (a) => /type\s*=\s*["']image\//i.test(a)) ?? /<img[^>]+src\s*=\s*["']([^"']+)["']/i.exec(cdata(summaryRaw))?.[1] ?? null);
    const id = stripHtml(tag(b, isAtom ? 'id' : 'guid') ?? '') || url;
    items.push({ externalId: id.slice(0, 300), title, url, summary, imageUrl: image, publishedAt: date > new Date(now.getTime() + 86_400_000) ? now : date });
  }
  return { title: titleRaw ? stripHtml(titleRaw).slice(0, 100) || null : null, items };
}
