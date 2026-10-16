import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import * as QRCode from 'qrcode';
import { Invoice } from './dataAccess.service';

type RGB = [number, number, number];

/**
 * Servicio reutilizable para generar el PDF de una factura con un diseño
 * profesional: cabecera con logo, franja resumen (nº, fecha, estado, total),
 * tarjetas emisor / cliente / vehículo, tabla de líneas con salto de página,
 * desglose de IVA por tipo, bloque VeriFactu con QR (si procede) y pie con
 * paginación en todas las hojas.
 *
 * Lo usan el cliente (invoice-viewer) y el taller (invoices-generator).
 */
@Injectable({ providedIn: 'root' })
export class InvoicePdfService {
  // Paleta de marca
  private readonly NARANJA: RGB = [232, 114, 43];
  private readonly OSCURO: RGB = [36, 41, 48];
  private readonly TEXTO: RGB = [45, 50, 58];
  private readonly GRIS: RGB = [118, 125, 135];
  private readonly LINEA: RGB = [226, 229, 234];
  private readonly FONDO: RGB = [246, 247, 249];

  private readonly LOGO_URL = 'assets/img/LogoFactura.png';

  private readonly M = 16;           // margen izquierdo
  private readonly R = 194;          // borde derecho del contenido
  private readonly W = 194 - 16;     // ancho útil
  private readonly Y_PIE = 280;      // inicio del pie de página

  async generatePDF(invoice: Invoice, registro?: any): Promise<void> {
    if (!invoice) return;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const numero = `AUTOCARE-${invoice.InvoiceID}`;
    doc.setProperties({
      title: `Factura ${numero}`,
      subject: `Factura de ${invoice.WorkshopName ?? 'taller'}`,
      creator: 'AutoCareHub',
    });

    const logo = await this.cargarImagen(this.LOGO_URL);
    const totales = this.calcularTotales(invoice);

    this.cabecera(doc, logo);
    let y = this.franjaResumen(doc, invoice, numero, totales.total, 44);
    y = this.tarjetas(doc, invoice, registro, y + 8);
    y = this.tablaLineas(doc, invoice, y + 8);
    y = this.bloqueTotales(doc, invoice, totales, y + 6);
    if (registro && registro.QrUrl) {
      await this.bloqueVerifactu(doc, registro, y + 8);
    }
    this.pies(doc, invoice);

    doc.save(`Factura_${this.slug(invoice.WorkshopName)}_${invoice.InvoiceID}.pdf`);
  }

  // ---------------- Secciones ----------------

  private cabecera(doc: jsPDF, logo: string | null): void {
    // Franja de color superior a sangre
    doc.setFillColor(...this.NARANJA);
    doc.rect(0, 0, 210, 3, 'F');

    // Logo + marca
    let xMarca = this.M;
    if (logo) {
      const p = doc.getImageProperties(logo);
      const h = 17;
      const w = (h * p.width) / p.height;
      doc.addImage(logo, 'PNG', this.M, 13, w, h, undefined, 'FAST');
      xMarca = this.M + w + 4;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.setTextColor(...this.OSCURO);
    doc.text('AutoCare', xMarca, 22.5);
    doc.setTextColor(...this.NARANJA);
    doc.text('Hub', xMarca + doc.getTextWidth('AutoCare'), 22.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...this.GRIS);
    doc.text('Gestión integral de talleres', xMarca, 27.5);

    // Título
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.setTextColor(...this.OSCURO);
    doc.text('FACTURA', this.R, 22, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...this.GRIS);
    doc.text('Original', this.R, 28, { align: 'right' });
  }

  /** Franja con los datos clave: nº, fecha, estado y total. */
  private franjaResumen(doc: jsPDF, invoice: Invoice, numero: string, total: number, y: number): number {
    const h = 17;
    doc.setFillColor(...this.FONDO);
    doc.roundedRect(this.M, y, this.W, h, 2.5, 2.5, 'F');

    const celdas = 4;
    const ancho = this.W / celdas;
    const etiquetas = ['Nº DE FACTURA', 'FECHA DE EMISIÓN', 'ESTADO', 'IMPORTE TOTAL'];
    for (let i = 0; i < celdas; i++) {
      const x = this.M + 6 + i * ancho;
      if (i > 0) {
        doc.setDrawColor(...this.LINEA);
        doc.setLineWidth(0.3);
        doc.line(this.M + i * ancho, y + 3.5, this.M + i * ancho, y + h - 3.5);
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor(...this.GRIS);
      doc.text(etiquetas[i], x, y + 6.3);
    }

    const yv = y + 12.6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...this.OSCURO);
    doc.text(numero, this.M + 6, yv);
    doc.text(this.fecha(invoice.Date), this.M + 6 + ancho, yv);
    this.estado(doc, invoice.Estado, this.M + 6 + 2 * ancho, yv);
    doc.setFontSize(12);
    doc.setTextColor(...this.NARANJA);
    doc.text(this.eur(total), this.M + 6 + 3 * ancho, yv + 0.3);

    return y + h;
  }

  /** Tarjetas Emitida por / Facturar a / Vehículo. */
  private tarjetas(doc: jsPDF, invoice: Invoice, registro: any, y: number): number {
    const sep = 5;
    const ancho = (this.W - 2 * sep) / 3;
    const vehiculo = [invoice.Marca, invoice.Modelo].filter(Boolean).join(' ');

    const bloques: { titulo: string; principal: string; lineas: string[] }[] = [
      {
        titulo: 'EMITIDA POR',
        principal: invoice.WorkshopName ?? 'Taller',
        lineas: [
          invoice.WorkshopAddress ?? '',
          invoice.WorkshopPhone ? `Tel. ${invoice.WorkshopPhone}` : '',
          registro?.NIF ? `NIF ${registro.NIF}` : '',
        ],
      },
      {
        titulo: 'FACTURAR A',
        principal: invoice.UserName ?? 'Cliente',
        lineas: [invoice.AppointmentID ? `Cita nº ${invoice.AppointmentID}` : ''],
      },
      {
        titulo: 'VEHÍCULO',
        principal: vehiculo || '—',
        lineas: [invoice.Anyo ? `Año ${invoice.Anyo}` : ''],
      },
    ];

    // Se maqueta primero para que las tres tarjetas tengan la misma altura
    const contenido = bloques.map((b) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      const principal = doc.splitTextToSize(b.principal, ancho - 10) as string[];
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.8);
      const lineas = b.lineas
        .filter(Boolean)
        .flatMap((l) => doc.splitTextToSize(l, ancho - 10) as string[]);
      return { titulo: b.titulo, principal, lineas };
    });
    const alto = Math.max(
      ...contenido.map((c) => 13 + c.principal.length * 4.8 + c.lineas.length * 4.3)
    ) + 3;

    contenido.forEach((c, i) => {
      const x = this.M + i * (ancho + sep);
      doc.setDrawColor(...this.LINEA);
      doc.setLineWidth(0.3);
      doc.roundedRect(x, y, ancho, alto, 2.5, 2.5, 'S');
      doc.setFillColor(...this.NARANJA);
      doc.rect(x + 5, y + 5, 6, 0.9, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...this.GRIS);
      doc.text(c.titulo, x + 5, y + 10.5);

      let yy = y + 16.5;
      doc.setFontSize(10.5);
      doc.setTextColor(...this.OSCURO);
      doc.text(c.principal, x + 5, yy);
      yy += c.principal.length * 4.8;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.8);
      doc.setTextColor(...this.GRIS);
      c.lineas.forEach((l) => { doc.text(l, x + 5, yy); yy += 4.3; });
    });

    return y + alto;
  }

  private tablaLineas(doc: jsPDF, invoice: Invoice, y: number): number {
    const items = invoice.items || [];
    const cuerpo = items.length
      ? items.map((it) => {
          const base = (Number(it.Quantity) || 0) * (Number(it.UnitPrice) || 0);
          return [
            String(it.Description ?? ''),
            this.num(it.Quantity),
            this.eur(it.UnitPrice),
            `${this.num(it.TaxRate)} %`,
            this.eur(base),
          ];
        })
      : [['Sin conceptos', '', '', '', '']];

    autoTable(doc, {
      startY: y,
      margin: { left: this.M, right: 210 - this.R, top: 16, bottom: 297 - this.Y_PIE + 6 },
      head: [['Concepto', 'Cant.', 'Precio unit.', 'IVA', 'Importe']],
      body: cuerpo,
      theme: 'plain',
      showHead: 'everyPage',
      styles: {
        font: 'helvetica',
        fontSize: 9,
        textColor: this.TEXTO,
        cellPadding: { top: 3.4, bottom: 3.4, left: 4, right: 4 },
        valign: 'middle',
      },
      headStyles: {
        fillColor: this.OSCURO,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        // Borde del mismo color que el fondo para tapar las juntas entre celdas
        lineWidth: 0.2,
        lineColor: this.OSCURO,
        cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
      },
      alternateRowStyles: { fillColor: this.FONDO },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 18, halign: 'right' },
        2: { cellWidth: 28, halign: 'right' },
        3: { cellWidth: 18, halign: 'right' },
        4: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
      },
      didParseCell: (data) => {
        // Alinear las cabeceras numéricas con su columna
        if (data.section === 'head' && data.column.index > 0) {
          data.cell.styles.halign = 'right';
        }
      },
      didDrawCell: (data) => {
        // Separador fino bajo cada fila del cuerpo
        if (data.section === 'body') {
          doc.setDrawColor(...this.LINEA);
          doc.setLineWidth(0.2);
          const yb = data.cell.y + data.cell.height;
          doc.line(data.cell.x, yb, data.cell.x + data.cell.width, yb);
        }
      },
    });

    return (doc as any).lastAutoTable.finalY;
  }

  private bloqueTotales(
    doc: jsPDF,
    invoice: Invoice,
    t: { base: number; total: number; porTipo: { tipo: number; base: number; cuota: number }[] },
    y: number
  ): number {
    const alto = 22 + t.porTipo.length * 6;
    y = this.asegurarEspacio(doc, y, alto);

    // Columna izquierda: nota según el estado
    const pagada = this.esPagada(invoice.Estado);
    const anchoNota = 84;
    doc.setFillColor(...this.FONDO);
    doc.roundedRect(this.M, y, anchoNota, 20, 2.5, 2.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...this.OSCURO);
    doc.text(pagada ? 'Factura pagada' : 'Pendiente de pago', this.M + 5, y + 7.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.2);
    doc.setTextColor(...this.GRIS);
    const nota = pagada
      ? `Gracias por confiar en ${invoice.WorkshopName ?? 'nuestro taller'}.`
      : 'Puedes abonar el importe en el taller. Conserva esta factura como justificante.';
    doc.text(doc.splitTextToSize(nota, anchoNota - 10), this.M + 5, y + 12.5);

    // Columna derecha: desglose
    const xL = 118;
    const xV = this.R - 4;
    let yy = y + 5;
    doc.setFontSize(9);
    doc.setTextColor(...this.GRIS);
    doc.text('Base imponible', xL, yy);
    doc.setTextColor(...this.TEXTO);
    doc.text(this.eur(t.base), xV, yy, { align: 'right' });
    t.porTipo.forEach((p) => {
      yy += 6;
      doc.setTextColor(...this.GRIS);
      doc.text(`IVA ${this.num(p.tipo)} %`, xL, yy);
      doc.setTextColor(...this.TEXTO);
      doc.text(this.eur(p.cuota), xV, yy, { align: 'right' });
    });

    yy += 4;
    doc.setFillColor(...this.NARANJA);
    doc.roundedRect(xL - 4, yy, this.R - (xL - 4), 11, 2.5, 2.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text('TOTAL', xL, yy + 7.2);
    doc.setFontSize(13);
    doc.text(this.eur(t.total), xV, yy + 7.5, { align: 'right' });

    return Math.max(y + 20, yy + 11);
  }

  private async bloqueVerifactu(doc: jsPDF, registro: any, y: number): Promise<void> {
    const alto = 34;
    y = this.asegurarEspacio(doc, y, alto);

    doc.setDrawColor(...this.LINEA);
    doc.setLineWidth(0.3);
    doc.roundedRect(this.M, y, this.W, alto, 2.5, 2.5, 'S');

    // QR tributario con su leyenda encima, como pide el reglamento
    const xq = this.M + 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...this.GRIS);
    doc.text('QR tributario:', xq, y + 5.5);
    try {
      const qr = await QRCode.toDataURL(registro.QrUrl, { margin: 0, width: 300 });
      doc.addImage(qr, 'PNG', xq, y + 7, 24, 24);
    } catch { /* sin QR */ }

    const tx = this.M + 36;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...this.NARANJA);
    doc.text('VERI*FACTU', tx, y + 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.2);
    doc.setTextColor(...this.TEXTO);
    doc.text('Factura verificable en la sede electrónica de la AEAT.', tx, y + 15.5);

    doc.setFontSize(7.5);
    doc.setTextColor(...this.GRIS);
    doc.text(`Nº de serie: ${registro.NumSerieFactura}     NIF emisor: ${registro.NIF}`, tx, y + 21);
    doc.setFont('courier', 'normal');
    doc.setFontSize(6.8);
    const huella = doc.splitTextToSize(`Huella: ${registro.Huella ?? ''}`, this.R - tx - 5);
    doc.text(huella, tx, y + 26);
  }

  /** Pie con datos del taller y paginación en todas las hojas. */
  private pies(doc: jsPDF, invoice: Invoice): void {
    const total = doc.getNumberOfPages();
    const datos = [invoice.WorkshopName, invoice.WorkshopAddress, invoice.WorkshopPhone && `Tel. ${invoice.WorkshopPhone}`]
      .filter(Boolean)
      .join('  ·  ');
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.setDrawColor(...this.LINEA);
      doc.setLineWidth(0.3);
      doc.line(this.M, this.Y_PIE, this.R, this.Y_PIE);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...this.GRIS);
      doc.text(datos || 'AutoCareHub', this.M, this.Y_PIE + 5);
      doc.text('Documento generado con AutoCareHub', this.M, this.Y_PIE + 9);
      doc.text(`Página ${i} de ${total}`, this.R, this.Y_PIE + 5, { align: 'right' });
    }
  }

  // ---------------- Helpers ----------------

  private calcularTotales(invoice: Invoice) {
    const grupos = new Map<number, { base: number; cuota: number }>();
    let base = 0;
    (invoice.items || []).forEach((it) => {
      const b = (Number(it.Quantity) || 0) * (Number(it.UnitPrice) || 0);
      const tipo = Number(it.TaxRate) || 0;
      const g = grupos.get(tipo) ?? { base: 0, cuota: 0 };
      g.base += b;
      g.cuota += b * (tipo / 100);
      grupos.set(tipo, g);
      base += b;
    });
    const porTipo = [...grupos.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([tipo, g]) => ({ tipo, ...g }));
    if (!porTipo.length) porTipo.push({ tipo: 21, base: 0, cuota: 0 });
    const total = base + porTipo.reduce((s, p) => s + p.cuota, 0);
    return { base, total, porTipo };
  }

  /** Si no cabe un bloque de `alto` mm antes del pie, pasa a una hoja nueva. */
  private asegurarEspacio(doc: jsPDF, y: number, alto: number): number {
    if (y + alto > this.Y_PIE - 6) {
      doc.addPage();
      return 20;
    }
    return y;
  }

  private estado(doc: jsPDF, estado: string, x: number, y: number): void {
    const e = (estado || '').toLowerCase();
    const color: RGB = this.esPagada(estado)
      ? [46, 160, 90]
      : e.startsWith('cancel')
        ? [214, 64, 69]
        : [230, 145, 20];
    const txt = this.esPagada(estado) ? 'Pagada' : estado || '—';
    doc.setFillColor(...color);
    doc.circle(x + 1.3, y - 1.3, 1.3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...color);
    doc.text(txt, x + 4.5, y);
  }

  private esPagada(estado: string): boolean {
    return /^pagad[oa]$/i.test(estado || '');
  }

  /** Descarga una imagen y la devuelve como data URL (null si falla). */
  private async cargarImagen(url: string): Promise<string | null> {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const bytes = new Uint8Array(await res.arrayBuffer());
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) {
        bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      }
      return 'data:image/png;base64,' + btoa(bin);
    } catch {
      return null;
    }
  }

  private eur(n: any): string {
    const val = Number(n) || 0;
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', useGrouping: 'always' } as any).format(val);
  }

  private num(n: any): string {
    return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2, useGrouping: 'always' } as any).format(Number(n) || 0);
  }

  private fecha(s: string): string {
    if (!s) return '';
    const p = s.substring(0, 10).split('-');
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : s;
  }

  private slug(s?: string): string {
    return (s ?? 'taller').replace(/[^a-zA-Z0-9]+/g, '_');
  }
}
