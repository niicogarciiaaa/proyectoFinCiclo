import { Celda, descargarXlsx, Hoja } from './xlsx.util';

/** Respuesta de accounting.php (acción «trimestre»). */
export interface ExportacionTrimestre {
  periodo: { anyo: number; trimestre: number; inicio: string; fin: string };
  taller: { Nombre: string; Direccion: string; NIF: string | null; RazonSocial: string | null };
  facturas: {
    InvoiceID: number; Numero: string; Fecha: string; Estado: string;
    Cliente: string; Email: string; Vehiculo: string; Matricula: string;
    Tipos: { Tipo: number; Base: number; Cuota: number }[];
    Base: number; Cuota: number; Total: number; VeriFactu: boolean;
  }[];
  resumen: { Tipo: number; Base: number; Cuota: number; Total: number; Facturas: number }[];
  totales: { Base: number; Cuota: number; Total: number; Cobrado: number; Pendiente: number; Facturas: number };
}

const cab = (v: string): Celda => ({ v, s: 'cabecera' });
const eur = (v: number): Celda => ({ v, s: 'euro' });
const eurN = (v: number): Celda => ({ v, s: 'euroNegrita' });
const pct = (v: number): Celda => ({ v, s: 'porcentaje' });
const neg = (v: string): Celda => ({ v, s: 'negrita' });

function fecha(iso: string): Date | string {
  const [a, m, d] = (iso || '').substring(0, 10).split('-').map(Number);
  return a && m && d ? new Date(a, m - 1, d) : iso;
}

function fechaTexto(iso: string): string {
  const [a, m, d] = (iso || '').substring(0, 10).split('-');
  return d ? `${d}/${m}/${a}` : iso;
}

/**
 * Descarga el Excel para el gestor con tres hojas: resumen por tipo de IVA,
 * libro de IVA repercutido (una fila por factura y tipo) y listado de facturas.
 */
export function descargarExportacionGestor(datos: ExportacionTrimestre): void {
  const { periodo, taller, facturas, resumen, totales } = datos;
  const etiqueta = `${periodo.trimestre}T ${periodo.anyo}`;
  const emisor = taller.RazonSocial || taller.Nombre;

  const hojaResumen: Hoja = {
    nombre: 'Resumen',
    anchos: [26, 14, 18, 16, 18],
    filas: [
      [{ v: `Facturación ${etiqueta}`, s: 'titulo' }],
      [`${emisor}${taller.NIF ? ' · NIF ' + taller.NIF : ' · (NIF sin configurar)'}`],
      [`Periodo: ${fechaTexto(periodo.inicio)} – ${fechaTexto(periodo.fin)}`],
      [],
      [neg('IVA repercutido por tipo')],
      [cab('Tipo de IVA'), cab('Nº facturas'), cab('Base imponible'), cab('Cuota de IVA'), cab('Total')],
      ...resumen.map((r) => [pct(r.Tipo), r.Facturas, eur(r.Base), eur(r.Cuota), eur(r.Total)]),
      [neg('Total'), { v: totales.Facturas, s: 'negrita' }, eurN(totales.Base), eurN(totales.Cuota), eurN(totales.Total)],
      [],
      [neg('Cobro')],
      ['Cobrado', null, eur(totales.Cobrado)],
      ['Pendiente de cobro', null, eur(totales.Pendiente)],
      [],
      ['Importes calculados a partir de las líneas de cada factura (base × tipo).'],
      ['Generado con AutoCareHub. Revísalo con tu gestor antes de presentar la declaración.'],
    ],
  };

  const libro: Hoja = {
    nombre: 'Libro IVA repercutido',
    anchos: [12, 18, 28, 16, 10, 14, 16],
    filas: [
      [cab('Fecha'), cab('Nº factura'), cab('Cliente'), cab('Base imponible'), cab('Tipo'), cab('Cuota IVA'), cab('Total')],
      ...facturas.flatMap((f) =>
        (f.Tipos.length ? f.Tipos : [{ Tipo: 0, Base: 0, Cuota: 0 }]).map((t) => [
          { v: fecha(f.Fecha) }, f.Numero, f.Cliente, eur(t.Base), pct(t.Tipo), eur(t.Cuota), eur(Math.round((t.Base + t.Cuota) * 100) / 100),
        ])
      ),
      [neg('Total'), null, null, eurN(totales.Base), null, eurN(totales.Cuota), eurN(totales.Total)],
    ],
  };

  const listado: Hoja = {
    nombre: 'Facturas',
    anchos: [18, 12, 26, 28, 20, 12, 12, 16, 14, 16, 11],
    filas: [
      [cab('Nº factura'), cab('Fecha'), cab('Cliente'), cab('Email'), cab('Vehículo'), cab('Matrícula'),
        cab('Estado'), cab('Base imponible'), cab('IVA'), cab('Total'), cab('VeriFactu')],
      ...facturas.map((f) => [
        f.Numero, { v: fecha(f.Fecha) }, f.Cliente, f.Email, f.Vehiculo, (f.Matricula || '').toUpperCase(),
        f.Estado === 'Pagado' ? 'Pagada' : f.Estado, eur(f.Base), eur(f.Cuota), eur(f.Total), f.VeriFactu ? 'Sí' : 'No',
      ]),
    ],
  };

  const nombre = `Facturacion_${periodo.anyo}_${periodo.trimestre}T_${taller.Nombre}.xlsx`;
  descargarXlsx(nombre, [hojaResumen, libro, listado]);
}
