import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import * as QRCode from 'qrcode';
import { Invoice } from './dataAccess.service';

/**
 * Servicio reutilizable para generar el PDF de una factura con un diseño
 * profesional (cabecera con logo, bloques emisor/cliente, tabla de líneas,
 * desglose base/IVA/total y, si procede, bloque VeriFactu con QR).
 *
 * Lo usan el cliente (invoice-viewer) y el taller (invoices-generator).
 */
@Injectable({ providedIn: 'root' })
export class InvoicePdfService {
  // Paleta de marca
  private readonly NARANJA: [number, number, number] = [232, 114, 43];
  private readonly TEXTO: [number, number, number] = [40, 40, 40];
  private readonly GRIS: [number, number, number] = [120, 120, 120];
  private readonly LINEA: [number, number, number] = [225, 228, 232];
  private readonly FILA: [number, number, number] = [248, 249, 251];

  private readonly M = 15;          // margen izquierdo
  private readonly R = 195;         // borde derecho del contenido

  async generatePDF(invoice: Invoice, registro?: any): Promise<void> {
    if (!invoice) return;
    const doc = new jsPDF();

    this.cabecera(doc, invoice);
    const yTrasPartes = this.bloquesEmisorCliente(doc, invoice, registro);
    const yTrasTabla = this.tablaLineas(doc, invoice, yTrasPartes + 6);
    this.totales(doc, invoice, yTrasTabla + 4);
    if (registro && registro.QrUrl) {
      await this.bloqueVerifactu(doc, registro);
    }
    this.pie(doc, invoice);

    doc.save(`Factura_${this.slug(invoice.WorkshopName)}_${invoice.InvoiceID}.pdf`);
  }

  // ---------------- Secciones ----------------

  private cabecera(doc: jsPDF, invoice: Invoice): void {
    // Logo (si carga) arriba a la izquierda
    try {
      doc.addImage('assets/img/LogoNaranjaAplicacion.png', 'PNG', this.M, 12, 34, 16);
    } catch {
      doc.setTextColor(...this.NARANJA);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text('AutoCareHub', this.M, 22);
    }

    // Título FACTURA a la derecha
    doc.setTextColor(...this.NARANJA);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(26);
    doc.text('FACTURA', this.R, 20, { align: 'right' });

    doc.setTextColor(...this.GRIS);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Nº AUTOCARE-${invoice.InvoiceID}`, this.R, 27, { align: 'right' });
    doc.text(`Fecha: ${this.fecha(invoice.Date)}`, this.R, 32, { align: 'right' });

    // Pastilla de estado
    this.pastillaEstado(doc, invoice.Estado, this.R, 35);

    // Regla naranja
    doc.setDrawColor(...this.NARANJA);
    doc.setLineWidth(0.8);
    doc.line(this.M, 42, this.R, 42);
  }

  private bloquesEmisorCliente(doc: jsPDF, invoice: Invoice, registro?: any): number {
    const yTop = 50;
    const colDer = 110;

    // EMISOR
    this.tituloBloque(doc, 'EMISOR', this.M, yTop);
    let y = yTop + 6;
    doc.setTextColor(...this.TEXTO);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(invoice.WorkshopName ?? 'Taller', this.M, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...this.GRIS);
    y += 5;
    if (invoice.WorkshopAddress) { doc.text(invoice.WorkshopAddress, this.M, y); y += 5; }
    if (invoice.WorkshopPhone) { doc.text(`Tel: ${invoice.WorkshopPhone}`, this.M, y); y += 5; }
    if (registro && registro.NIF) { doc.text(`NIF: ${registro.NIF}`, this.M, y); y += 5; }
    const yEmisorFin = y;

    // CLIENTE + VEHÍCULO
    this.tituloBloque(doc, 'CLIENTE', colDer, yTop);
    let yc = yTop + 6;
    doc.setTextColor(...this.TEXTO);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(invoice.UserName ?? '—', colDer, yc);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...this.GRIS);
    yc += 5;
    const vehiculo = [invoice.Marca, invoice.Modelo].filter(Boolean).join(' ');
    if (vehiculo) { doc.text(`Vehículo: ${vehiculo}`, colDer, yc); yc += 5; }
    if (invoice.Anyo) { doc.text(`Año: ${invoice.Anyo}`, colDer, yc); yc += 5; }

    return Math.max(yEmisorFin, yc);
  }

  private tablaLineas(doc: jsPDF, invoice: Invoice, y: number): number {
    const items = invoice.items || [];
    // Posiciones (bordes derechos para números)
    const xDesc = this.M + 2;
    const xCant = 128;
    const xPrecio = 150;
    const xIva = 168;
    const xImporte = this.R - 2;
    const filaH = 8;

    // Cabecera de la tabla
    doc.setFillColor(...this.NARANJA);
    doc.rect(this.M, y, this.R - this.M, filaH, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    const yh = y + 5.5;
    doc.text('DESCRIPCIÓN', xDesc, yh);
    doc.text('CANT.', xCant, yh, { align: 'right' });
    doc.text('PRECIO', xPrecio, yh, { align: 'right' });
    doc.text('IVA', xIva, yh, { align: 'right' });
    doc.text('IMPORTE', xImporte, yh, { align: 'right' });

    let yy = y + filaH;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...this.TEXTO);

    items.forEach((it, i) => {
      const desc = doc.splitTextToSize(String(it.Description ?? ''), 95);
      const h = Math.max(filaH, desc.length * 5 + 3);
      if (i % 2 === 1) {
        doc.setFillColor(...this.FILA);
        doc.rect(this.M, yy, this.R - this.M, h, 'F');
      }
      const base = (Number(it.Quantity) || 0) * (Number(it.UnitPrice) || 0);
      const yt = yy + 5.5;
      doc.setFontSize(9);
      doc.text(desc, xDesc, yt);
      doc.text(String(it.Quantity), xCant, yt, { align: 'right' });
      doc.text(this.eur(it.UnitPrice), xPrecio, yt, { align: 'right' });
      doc.text(`${Number(it.TaxRate)}%`, xIva, yt, { align: 'right' });
      doc.text(this.eur(base), xImporte, yt, { align: 'right' });
      yy += h;
    });

    // Borde inferior de la tabla
    doc.setDrawColor(...this.LINEA);
    doc.setLineWidth(0.3);
    doc.line(this.M, yy, this.R, yy);
    return yy;
  }

  private totales(doc: jsPDF, invoice: Invoice, y: number): void {
    const items = invoice.items || [];
    let base = 0, iva = 0;
    items.forEach((it) => {
      const b = (Number(it.Quantity) || 0) * (Number(it.UnitPrice) || 0);
      base += b;
      iva += b * ((Number(it.TaxRate) || 0) / 100);
    });
    const total = base + iva;

    const xLabel = 140;
    const xVal = this.R - 2;
    doc.setFontSize(10);

    doc.setTextColor(...this.GRIS);
    doc.setFont('helvetica', 'normal');
    doc.text('Base imponible', xLabel, y + 6, { align: 'right' });
    doc.text(this.eur(base), xVal, y + 6, { align: 'right' });
    doc.text('IVA', xLabel, y + 12, { align: 'right' });
    doc.text(this.eur(iva), xVal, y + 12, { align: 'right' });

    // Caja del total
    doc.setFillColor(...this.NARANJA);
    doc.rect(xLabel - 30, y + 16, this.R - (xLabel - 30), 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('TOTAL', xLabel - 26, y + 22.5);
    doc.text(this.eur(total), xVal, y + 22.5, { align: 'right' });
  }

  private async bloqueVerifactu(doc: jsPDF, registro: any): Promise<void> {
    const y = 250;
    doc.setDrawColor(...this.LINEA);
    doc.setLineWidth(0.3);
    doc.roundedRect(this.M, y, this.R - this.M, 28, 2, 2, 'S');

    try {
      const qr = await QRCode.toDataURL(registro.QrUrl, { margin: 1, width: 240 });
      doc.addImage(qr, 'PNG', this.M + 3, y + 3, 22, 22);
    } catch { /* sin QR */ }

    const tx = this.M + 30;
    doc.setTextColor(...this.NARANJA);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('VERI*FACTU', tx, y + 7);
    doc.setTextColor(...this.GRIS);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('Factura verificable en la sede electrónica de la AEAT.', tx, y + 12);
    doc.text(`Nº ${registro.NumSerieFactura}   ·   NIF ${registro.NIF}`, tx, y + 16.5);
    const huella = String(registro.Huella ?? '');
    doc.text(`Huella: ${huella}`, tx, y + 21, { maxWidth: this.R - tx - 4 });
  }

  private pie(doc: jsPDF, invoice: Invoice): void {
    doc.setDrawColor(...this.LINEA);
    doc.setLineWidth(0.3);
    doc.line(this.M, 285, this.R, 285);
    doc.setTextColor(...this.GRIS);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(
      `Gracias por confiar en ${invoice.WorkshopName ?? 'nuestro taller'}.`,
      this.M, 290
    );
    doc.text('Documento generado por AutoCareHub', this.R, 290, { align: 'right' });
  }

  // ---------------- Helpers ----------------

  private pastillaEstado(doc: jsPDF, estado: string, xRight: number, y: number): void {
    const map: { [k: string]: [number, number, number] } = {
      Pagado: [67, 160, 71],
      Pendiente: [251, 140, 0],
      Cancelado: [229, 57, 53],
    };
    const color = map[estado] ?? this.GRIS;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    const txt = (estado || '').toUpperCase();
    const w = doc.getTextWidth(txt) + 8;
    doc.setFillColor(...color);
    doc.roundedRect(xRight - w, y, w, 6.5, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text(txt, xRight - w / 2, y + 4.6, { align: 'center' });
  }

  private tituloBloque(doc: jsPDF, txt: string, x: number, y: number): void {
    doc.setTextColor(...this.NARANJA);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(txt, x, y);
    doc.setDrawColor(...this.LINEA);
    doc.setLineWidth(0.3);
    doc.line(x, y + 1.5, x + 80, y + 1.5);
  }

  private eur(n: any): string {
    const val = Number(n) || 0;
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(val);
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
