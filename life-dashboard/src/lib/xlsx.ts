/**
 * Lector mínimo de Excel (.xlsx) sin dependencias: abre el ZIP, lee la primera hoja y devuelve sus filas como texto.
 * Las fechas (celdas con formato de fecha) salen como dd/mm/aaaa y los números con coma decimal, igual que en un CSV
 * español, para reutilizar el mismo análisis (columnas, importes, duplicados) que la importación CSV.
 * Funciona en el navegador y en Node (usa DecompressionStream).
 */

const MAX_ENTRY_BYTES = 40_000_000; // límite por fichero descomprimido (protección contra «zip bombs»)
const MAX_ROWS = 20_000;

export class XlsxError extends Error {}

export function looksLikeXlsx(buf: Uint8Array) { return buf[0] === 0x50 && buf[1] === 0x4b; } // «PK»: ZIP
export function looksLikeOldXls(buf: Uint8Array) { return buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0; }

// ───────────── ZIP ─────────────
interface ZipEntry { method: number; compressedSize: number; size: number; offset: number }

function readZipDirectory(buf: Uint8Array): Map<string, ZipEntry> {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new XlsxError('El archivo no es un Excel válido o está dañado.');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const out = new Map<string, ZipEntry>();
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (p + 46 > buf.length || dv.getUint32(p, true) !== 0x02014b50) throw new XlsxError('El archivo Excel está dañado.');
    const method = dv.getUint16(p + 10, true);
    const compressedSize = dv.getUint32(p + 20, true);
    const size = dv.getUint32(p + 24, true);
    const nameLen = dv.getUint16(p + 28, true), extraLen = dv.getUint16(p + 30, true), commentLen = dv.getUint16(p + 32, true);
    const offset = dv.getUint32(p + 42, true);
    out.set(dec.decode(buf.subarray(p + 46, p + 46 + nameLen)), { method, compressedSize, size, offset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_ENTRY_BYTES) { await reader.cancel(); throw new XlsxError('El archivo Excel es demasiado grande.'); }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

async function readEntry(buf: Uint8Array, dir: Map<string, ZipEntry>, name: string): Promise<string | null> {
  const e = dir.get(name);
  if (!e) return null;
  if (e.size > MAX_ENTRY_BYTES) throw new XlsxError('El archivo Excel es demasiado grande.');
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (e.offset + 30 > buf.length || dv.getUint32(e.offset, true) !== 0x04034b50) throw new XlsxError('El archivo Excel está dañado.');
  const start = e.offset + 30 + dv.getUint16(e.offset + 26, true) + dv.getUint16(e.offset + 28, true);
  const raw = buf.subarray(start, start + e.compressedSize);
  const bytes = e.method === 0 ? raw : e.method === 8 ? await inflateRaw(raw) : null;
  if (!bytes) throw new XlsxError('El archivo Excel usa una compresión no admitida.');
  return new TextDecoder().decode(bytes);
}

// ───────────── XML ─────────────
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
export function decodeXml(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) => {
    if (e[0] === '#') { const cp = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(cp) && cp <= 0x10ffff ? String.fromCodePoint(cp) : ''; }
    return ENTITIES[e.toLowerCase()] ?? '';
  });
}
const attr = (tag: string, name: string) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
/** Texto de un <si> o <is>: concatena los <t> (también los de cada «run» <r>), sin la guía fonética <rPh>. */
const richText = (xml: string) => decodeXml([...xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(''));

export function parseSharedStrings(xml: string): string[] {
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g)].map((m) => richText(m[1] ?? ''));
}

/** Índices de estilo (cellXfs) cuyo formato numérico es una fecha. */
export function dateStyles(xml: string): Set<number> {
  const custom = new Map<number, string>();
  for (const m of xml.matchAll(/<numFmt\s[^>]*>/g)) custom.set(Number(attr(m[0], 'numFmtId')), decodeXml(attr(m[0], 'formatCode') ?? ''));
  const isDateFmt = (id: number) => {
    if ((id >= 14 && id <= 22) || (id >= 45 && id <= 47) || (id >= 27 && id <= 36) || (id >= 50 && id <= 58)) return true;
    const code = custom.get(id);
    if (!code) return false;
    const plain = code.replace(/"[^"]*"|\[[^\]]*\]|\\./g, ''); // sin textos literales, colores ni escapes
    return /[dmy]/i.test(plain) && !/^[#0.,\s%]*$/.test(plain);
  };
  const xfs = xml.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1] ?? '';
  const out = new Set<number>();
  [...xfs.matchAll(/<xf\s[^>]*?(?:\/>|>)/g)].forEach((m, i) => { if (isDateFmt(Number(attr(m[0], 'numFmtId') ?? -1))) out.add(i); });
  return out;
}

const colIndex = (ref: string) => { let n = 0; for (const ch of ref.replace(/\d+$/, '').toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };
const pad = (n: number) => String(n).padStart(2, '0');

/** Número de serie de Excel → dd/mm/aaaa (sistema 1900 o 1904). */
export function serialToDate(serial: number, date1904 = false): string {
  const ms = Math.round((serial + (date1904 ? 1462 : 0)) * 86_400_000) + Date.UTC(1899, 11, 30);
  const d = new Date(ms);
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

/** Número con coma decimal y sin miles («-1234,5»), que el analizador de importes lee sin ambigüedad. */
const numText = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');

export function parseSheet(xml: string, shared: string[], dates: Set<number>, date1904 = false): string[][] {
  const rows: string[][] = [];
  for (const rm of xml.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const row: string[] = [];
    for (const cm of (rm[1] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const tag = cm[1]!, body = cm[2] ?? '';
      const ref = attr(tag, 'r');
      const idx = ref ? colIndex(ref) : row.length;
      if (idx < 0 || idx > 500) continue;
      const t = attr(tag, 't');
      const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let text = '';
      if (t === 's') text = shared[Number(v)] ?? '';
      else if (t === 'inlineStr') text = richText(body.match(/<is>([\s\S]*?)<\/is>/)?.[1] ?? '');
      else if (t === 'str' || t === 'e') text = decodeXml(v ?? '');
      else if (t === 'b') text = v === '1' ? 'VERDADERO' : 'FALSO';
      else if (v !== undefined) {
        const n = Number(v);
        if (!Number.isFinite(n)) text = decodeXml(v);
        else if (dates.has(Number(attr(tag, 's') ?? 0)) && n > 0 && n < 2_958_466) text = serialToDate(n, date1904);
        else text = numText(n);
      }
      while (row.length < idx) row.push('');
      row[idx] = text.trim();
    }
    if (row.some((c) => c !== '')) rows.push(row);
    if (rows.length > MAX_ROWS) throw new XlsxError(`El archivo tiene más de ${MAX_ROWS} filas.`);
  }
  return rows;
}

/** Ruta de la primera hoja del libro (según workbook.xml y sus relaciones). */
function firstSheetPath(workbook: string, rels: string | null, dir: Map<string, ZipEntry>): string | null {
  const rid = workbook.match(/<sheet\b[^>]*>/)?.[0].match(/\sr:id="([^"]*)"/)?.[1];
  if (rid && rels) {
    const rel = [...rels.matchAll(/<Relationship\b[^>]*>/g)].map((m) => m[0]).find((r) => attr(r, 'Id') === rid);
    const target = rel && attr(rel, 'Target');
    if (target) {
      const path = target.startsWith('/') ? target.slice(1) : `xl/${target}`.replace(/\/\.\//g, '/');
      if (dir.has(path)) return path;
    }
  }
  return [...dir.keys()].filter((k) => /^xl\/worksheets\/[^/]+\.xml$/.test(k)).sort()[0] ?? null;
}

/** Lee la primera hoja de un .xlsx y devuelve sus filas (sin filas vacías). */
export async function readXlsx(data: ArrayBuffer | Uint8Array): Promise<string[][]> {
  const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (looksLikeOldXls(buf)) throw new XlsxError('Es un Excel antiguo (.xls). Ábrelo con Excel y guárdalo como .xlsx o CSV.');
  if (!looksLikeXlsx(buf)) throw new XlsxError('El archivo no es un Excel .xlsx.');
  const dir = readZipDirectory(buf);
  const workbook = await readEntry(buf, dir, 'xl/workbook.xml');
  if (!workbook) throw new XlsxError('El archivo no es un Excel .xlsx.');
  const sheetPath = firstSheetPath(workbook, await readEntry(buf, dir, 'xl/_rels/workbook.xml.rels'), dir);
  const sheet = sheetPath ? await readEntry(buf, dir, sheetPath) : null;
  if (!sheet) throw new XlsxError('El Excel no tiene ninguna hoja.');
  const shared = parseSharedStrings((await readEntry(buf, dir, 'xl/sharedStrings.xml')) ?? '');
  const dates = dateStyles((await readEntry(buf, dir, 'xl/styles.xml')) ?? '');
  const date1904 = /<workbookPr\b[^>]*\sdate1904="(1|true)"/.test(workbook);
  return parseSheet(sheet, shared, dates, date1904);
}

/** Filas → CSV con «;» (comillas cuando hace falta), para pasar por el mismo análisis que un CSV. */
export function rowsToCsv(rows: string[][]): string {
  const q = (c: string) => (/[;"\r\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c);
  return rows.map((r) => r.map(q).join(';')).join('\n');
}
