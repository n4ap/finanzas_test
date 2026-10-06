import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { detectMapping, findHeaderRow, mapRows, parseCsv } from './finance';
import { dateStyles, decodeXml, parseSheet, parseSharedStrings, readXlsx, rowsToCsv, serialToDate, XlsxError } from './xlsx';

/** ZIP mínimo (como el que genera Excel) para construir .xlsx de prueba. */
function zip(files: Record<string, string>, store = false): Uint8Array {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [], central: Uint8Array[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const raw = enc.encode(text), data = store ? raw : new Uint8Array(deflateRawSync(raw)), nm = enc.encode(name);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); local.setUint16(8, store ? 0 : 8, true);
    local.setUint32(18, data.length, true); local.setUint32(22, raw.length, true); local.setUint16(26, nm.length, true);
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true); cd.setUint16(10, store ? 0 : 8, true);
    cd.setUint32(20, data.length, true); cd.setUint32(24, raw.length, true); cd.setUint16(28, nm.length, true); cd.setUint32(42, offset, true);
    parts.push(new Uint8Array(local.buffer), nm, data);
    central.push(new Uint8Array(cd.buffer), nm);
    offset += 30 + nm.length + data.length;
  }
  const cdSize = central.reduce((a, b) => a + b.length, 0);
  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054b50, true); eocd.setUint16(8, Object.keys(files).length, true); eocd.setUint16(10, Object.keys(files).length, true);
  eocd.setUint32(12, cdSize, true); eocd.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(eocd.buffer)];
  const out = new Uint8Array(all.reduce((a, b) => a + b.length, 0));
  let o = 0;
  for (const p of all) { out.set(p, o); o += p.length; }
  return out;
}

const WORKBOOK = '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><workbookPr/><sheets><sheet name="Movimientos" sheetId="1" r:id="rId1"/></sheets></workbook>';
const RELS = '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/movs.xml"/></Relationships>';
const STYLES = '<styleSheet><numFmts count="2"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="#,##0.00\\ &quot;€&quot;"/></numFmts><cellXfs count="4"><xf numFmtId="0" fontId="0"/><xf numFmtId="164" fontId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0"/><xf numFmtId="14" fontId="0"/></cellXfs></styleSheet>';
const SHARED = '<sst count="9"><si><t>Extracto de cuenta</t></si><si><t>Cuenta: ES00 0128 **** 1234</t></si><si><t>FECHA CONTABLE</t></si><si><t>FECHA VALOR</t></si><si><r><t>DESCRIP</t></r><r><rPr><b/></rPr><t>CIÓN</t></r></si><si><t>IMPORTE</t></si><si><t>SALDO</t></si><si><t>MERCADONA ZARAGOZA</t></si><si><t xml:space="preserve">NOMINA &quot;EJERCITO&quot; OCT </t></si></sst>';
// Fila 1-2: presentación; 3 vacía (autocerrada); 4: cabecera; 5-7: datos (fechas como número de serie y como texto).
const SHEET = `<worksheet><sheetData>
<row r="1"><c r="A1" t="s"><v>0</v></c></row>
<row r="2"><c r="A2" t="s"><v>1</v></c></row>
<row r="3"/>
<row r="4"><c r="A4" t="s"><v>2</v></c><c r="B4" t="s"><v>3</v></c><c r="C4" t="s"><v>4</v></c><c r="D4" t="s"><v>5</v></c><c r="E4" t="s"><v>6</v></c></row>
<row r="5"><c r="A5" s="1"><v>46298</v></c><c r="B5" s="3"><v>46298</v></c><c r="C5" t="s"><v>7</v></c><c r="D5" s="2"><v>-45.3</v></c><c r="E5" s="2"><v>1954.7</v></c></row>
<row r="6"><c r="A6" s="1"><v>46297</v></c><c r="B6"/><c r="C6" t="s"><v>8</v></c><c r="D6" s="2"><v>2100</v></c><c r="E6" s="2"><v>2000.004</v></c></row>
<row r="7"><c r="A7" t="inlineStr"><is><t>01/10/2026</t></is></c><c r="C7" t="str"><v>RECIBO ENDESA; LUZ &amp; GAS</v></c><c r="D7"><v>-1234.5</v></c></row>
</sheetData></worksheet>`;
const xlsx = (store = false) => zip({ '[Content_Types].xml': '<Types/>', 'xl/workbook.xml': WORKBOOK, 'xl/_rels/workbook.xml.rels': RELS, 'xl/styles.xml': STYLES, 'xl/sharedStrings.xml': SHARED, 'xl/worksheets/movs.xml': SHEET }, store);

describe('readXlsx', () => {
  it('lee la primera hoja: textos compartidos, fechas, números y celdas vacías', async () => {
    const rows = await readXlsx(xlsx());
    expect(rows).toEqual([
      ['Extracto de cuenta'],
      ['Cuenta: ES00 0128 **** 1234'],
      ['FECHA CONTABLE', 'FECHA VALOR', 'DESCRIPCIÓN', 'IMPORTE', 'SALDO'],
      ['03/10/2026', '03/10/2026', 'MERCADONA ZARAGOZA', '-45,3', '1954,7'],
      ['02/10/2026', '', 'NOMINA "EJERCITO" OCT', '2100', '2000'],
      ['01/10/2026', '', 'RECIBO ENDESA; LUZ & GAS', '-1234,5'],
    ]);
  });

  it('admite ficheros sin comprimir dentro del ZIP', async () => {
    expect((await readXlsx(xlsx(true))).length).toBe(6);
  });

  it('extracto completo → CSV → mismas filas de importación que un CSV del banco', async () => {
    const parsed = parseCsv(rowsToCsv(await readXlsx(xlsx())));
    const at = findHeaderRow(parsed.rows);
    expect(at).toBe(2);
    const [header, ...data] = parsed.rows.slice(at);
    const mapping = detectMapping(header!)!;
    expect(mapping).toMatchObject({ date: 0, description: 2, amount: 3 });
    const rows = mapRows(data, mapping);
    expect(rows.map((r) => [r.date, r.description, r.amount, r.error])).toEqual([
      ['2026-10-03', 'MERCADONA ZARAGOZA', -45.3, undefined],
      ['2026-10-02', 'NOMINA "EJERCITO" OCT', 2100, undefined],
      ['2026-10-01', 'RECIBO ENDESA; LUZ & GAS', -1234.5, undefined],
    ]);
    expect(rows[1]!.category).toBe('ingresos');
  });

  it('rechaza el Excel antiguo (.xls) y lo que no es Excel con un mensaje claro', async () => {
    await expect(readXlsx(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0]))).rejects.toThrow(/Excel antiguo/);
    await expect(readXlsx(new TextEncoder().encode('Fecha;Concepto'))).rejects.toThrow(XlsxError);
    await expect(readXlsx(new Uint8Array([0x50, 0x4b, 3, 4, 0, 0]))).rejects.toThrow(/dañado|válido/);
  });

  it('sin relaciones usa la primera hoja que encuentre', async () => {
    const rows = await readXlsx(zip({ 'xl/workbook.xml': '<workbook><sheets><sheet name="A" sheetId="1"/></sheets></workbook>', 'xl/worksheets/sheet1.xml': '<worksheet><sheetData><row><c><v>7</v></c><c t="b"><v>1</v></c></row></sheetData></worksheet>' }));
    expect(rows).toEqual([['7', 'VERDADERO']]);
  });
});

describe('piezas del lector', () => {
  it('fechas: series de Excel en los sistemas 1900 y 1904', () => {
    expect(serialToDate(46298)).toBe('03/10/2026');
    expect(serialToDate(45658.75)).toBe('01/01/2025');
    expect(serialToDate(44836, true)).toBe('03/10/2026');
  });

  it('formatos de fecha: integrados y personalizados; los de moneda no', () => {
    expect([...dateStyles(STYLES)].sort()).toEqual([1, 3]);
    expect(dateStyles('<numFmts><numFmt numFmtId="170" formatCode="[$-C0A]d &quot;de&quot; mmmm"/><numFmt numFmtId="171" formatCode="0.00 &quot;días&quot;"/></numFmts><cellXfs><xf numFmtId="170"/><xf numFmtId="171"/></cellXfs>')).toEqual(new Set([0]));
  });

  it('textos: entidades XML, «runs» y sin guía fonética', () => {
    expect(decodeXml('a &amp; b &lt;c&gt; &#233;&#xF1;')).toBe('a & b <c> éñ');
    expect(parseSharedStrings('<sst><si><t>uno</t></si><si/><si><r><t>do</t></r><r><t>s</t></r><rPh><t>X</t></rPh></si></sst>')).toEqual(['uno', '', 'dos']);
  });

  it('una fila autocerrada no se traga la siguiente', () => {
    expect(parseSheet('<sheetData><row r="1"/><row r="2"><c r="C2" t="inlineStr"><is><t>x</t></is></c></row></sheetData>', [], new Set())).toEqual([['', '', 'x']]);
  });

  it('CSV de salida con comillas cuando hace falta', () => {
    expect(rowsToCsv([['a;b', 'c"d', 'e'], ['1']])).toBe('"a;b";"c""d";e\n1');
  });
});

describe('findHeaderRow', () => {
  it('encuentra la cabecera tras las filas de presentación; si no hay, la primera', () => {
    expect(findHeaderRow([['Titular'], ['Fecha', 'Concepto', 'Importe'], ['1/1/2026', 'x', '1']])).toBe(1);
    expect(findHeaderRow([['a', 'b'], ['c', 'd']])).toBe(0);
  });
});

describe('parseCsv con título previo', () => {
  it('detecta el separador aunque la primera línea no lo tenga', () => {
    const r = parseCsv('Extracto Bankinter\nTitular: DAVID\nFecha;Concepto;Importe\n03/10/2026;Bar, cafe;-2,5\n');
    expect(r.delimiter).toBe(';');
    expect(r.rows[3]).toEqual(['03/10/2026', 'Bar, cafe', '-2,5']);
  });
});
