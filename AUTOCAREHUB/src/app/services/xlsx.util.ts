/**
 * Generador mínimo de ficheros Excel (.xlsx) sin dependencias: varias hojas,
 * textos, números, fechas, importes en euros, negritas y anchos de columna.
 * Un .xlsx es un ZIP con XML dentro; aquí se empaqueta sin compresión.
 */

export type EstiloCelda = 'normal' | 'cabecera' | 'euro' | 'euroNegrita' | 'porcentaje' | 'fecha' | 'titulo' | 'negrita';

export interface Celda {
  v: string | number | Date | null;
  s?: EstiloCelda;
}

export interface Hoja {
  nombre: string;
  /** Ancho de cada columna (en caracteres). */
  anchos?: number[];
  filas: (Celda | string | number | null)[][];
}

// Orden de los estilos en styles.xml (cellXfs)
const ESTILOS: EstiloCelda[] = ['normal', 'cabecera', 'euro', 'euroNegrita', 'porcentaje', 'fecha', 'titulo', 'negrita'];

/** Crea el .xlsx y lo descarga en el navegador. */
export function descargarXlsx(nombreFichero: string, hojas: Hoja[]): void {
  const blob = new Blob([crearXlsx(hojas)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreFichero.replace(/[^\w.\-]+/g, '_');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function crearXlsx(hojas: Hoja[]): Uint8Array {
  const ficheros: { nombre: string; contenido: string }[] = [
    { nombre: '[Content_Types].xml', contenido: tiposContenido(hojas.length) },
    { nombre: '_rels/.rels', contenido: RELS },
    { nombre: 'xl/workbook.xml', contenido: libro(hojas) },
    { nombre: 'xl/_rels/workbook.xml.rels', contenido: relsLibro(hojas.length) },
    { nombre: 'xl/styles.xml', contenido: ESTILOS_XML },
    ...hojas.map((h, i) => ({ nombre: `xl/worksheets/sheet${i + 1}.xml`, contenido: hojaXml(h) })),
  ];
  const enc = new TextEncoder();
  return zip(ficheros.map((f) => ({ nombre: f.nombre, datos: enc.encode(f.contenido) })));
}

// ------------------------------------------------------------------
//  XML del libro
// ------------------------------------------------------------------

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

const RELS = XML +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
  '</Relationships>';

const ESTILOS_XML = XML +
  `<styleSheet xmlns="${NS}">` +
  '<numFmts count="2">' +
  '<numFmt numFmtId="164" formatCode="#,##0.00\\ &quot;€&quot;"/>' +
  '<numFmt numFmtId="165" formatCode="0&quot; %&quot;"/>' +
  '</numFmts>' +
  '<fonts count="3">' +
  '<font><sz val="11"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="11"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="14"/><name val="Calibri"/></font>' +
  '</fonts>' +
  '<fills count="3">' +
  '<fill><patternFill patternType="none"/></fill>' +
  '<fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFF3F4F6"/><bgColor indexed="64"/></patternFill></fill>' +
  '</fills>' +
  '<borders count="2">' +
  '<border><left/><right/><top/><bottom/><diagonal/></border>' +
  '<border><left/><right/><top/><bottom style="thin"><color rgb="FFD1D5DB"/></bottom><diagonal/></border>' +
  '</borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="8">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +                                    // normal
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>' + // cabecera
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +             // euro
  '<xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>' + // euroNegrita
  '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +             // porcentaje
  '<xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +              // fecha
  '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +                       // titulo
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +                       // negrita
  '</cellXfs>' +
  '</styleSheet>';

function tiposContenido(n: number): string {
  let hojas = '';
  for (let i = 1; i <= n; i++) {
    hojas += `<Override PartName="/xl/worksheets/sheet${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`;
  }
  return XML +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    hojas + '</Types>';
}

function libro(hojas: Hoja[]): string {
  const lista = hojas
    .map((h, i) => `<sheet name="${esc(nombreHoja(h.nombre))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
    .join('');
  return XML + `<workbook xmlns="${NS}" xmlns:r="${NS_R}"><sheets>${lista}</sheets></workbook>`;
}

function relsLibro(n: number): string {
  let rels = '';
  for (let i = 1; i <= n; i++) {
    rels += `<Relationship Id="rId${i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i}.xml"/>`;
  }
  rels += `<Relationship Id="rId${n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`;
  return XML + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`;
}

function hojaXml(h: Hoja): string {
  const cols = h.anchos?.length
    ? '<cols>' + h.anchos.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('') + '</cols>'
    : '';
  const filas = h.filas.map((fila, r) => {
    const celdas = fila.map((c, col) => celdaXml(c, `${columna(col)}${r + 1}`)).join('');
    return `<row r="${r + 1}">${celdas}</row>`;
  }).join('');
  return XML + `<worksheet xmlns="${NS}">${cols}<sheetData>${filas}</sheetData></worksheet>`;
}

function celdaXml(c: Celda | string | number | null, ref: string): string {
  const celda: Celda = c !== null && typeof c === 'object' && !(c instanceof Date) ? c : { v: c as any };
  const s = ESTILOS.indexOf(celda.s ?? 'normal');
  const attrS = s > 0 ? ` s="${s}"` : '';
  const v = celda.v;
  if (v === null || v === undefined || v === '') return '';
  if (v instanceof Date) {
    // Excel cuenta los días desde el 30/12/1899
    const serie = (Date.UTC(v.getFullYear(), v.getMonth(), v.getDate()) - Date.UTC(1899, 11, 30)) / 86400000;
    return `<c r="${ref}" s="${ESTILOS.indexOf('fecha')}"><v>${serie}</v></c>`;
  }
  if (typeof v === 'number' && isFinite(v)) {
    return `<c r="${ref}"${attrS}><v>${v}</v></c>`;
  }
  return `<c r="${ref}"${attrS} t="inlineStr"><is><t xml:space="preserve">${esc(String(v))}</t></is></c>`;
}

/** 0 → A, 25 → Z, 26 → AA... */
function columna(i: number): string {
  let s = '';
  for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  return s;
}

/** Excel no admite ciertos caracteres en el nombre de hoja ni más de 31. */
function nombreHoja(n: string): string {
  return n.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Hoja';
}

function esc(t: string): string {
  return t
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ------------------------------------------------------------------
//  ZIP sin compresión (método «store»)
// ------------------------------------------------------------------

const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(d: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < d.length; i++) c = TABLA_CRC[(c ^ d[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zip(ficheros: { nombre: string; datos: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder();
  const partes: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const f of ficheros) {
    const nombre = enc.encode(f.nombre);
    const crc = crc32(f.datos);
    const tam = f.datos.length;

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);       // versión necesaria
    local.setUint16(6, 0x0800, true);   // nombres en UTF-8
    local.setUint16(8, 0, true);        // sin compresión
    local.setUint32(14, crc, true);
    local.setUint32(18, tam, true);
    local.setUint32(22, tam, true);
    local.setUint16(26, nombre.length, true);
    partes.push(new Uint8Array(local.buffer), nombre, f.datos);

    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint16(8, 0x0800, true);
    cd.setUint16(10, 0, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, tam, true);
    cd.setUint32(24, tam, true);
    cd.setUint16(28, nombre.length, true);
    cd.setUint32(42, offset, true);
    central.push(new Uint8Array(cd.buffer), nombre);

    offset += 30 + nombre.length + tam;
  }

  const tamCentral = central.reduce((s, p) => s + p.length, 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true);
  fin.setUint16(8, ficheros.length, true);
  fin.setUint16(10, ficheros.length, true);
  fin.setUint32(12, tamCentral, true);
  fin.setUint32(16, offset, true);

  const todo = [...partes, ...central, new Uint8Array(fin.buffer)];
  const salida = new Uint8Array(todo.reduce((s, p) => s + p.length, 0));
  let pos = 0;
  for (const p of todo) {
    salida.set(p, pos);
    pos += p.length;
  }
  return salida;
}
