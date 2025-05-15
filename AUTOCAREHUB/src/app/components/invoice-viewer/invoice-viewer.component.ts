import { Component, OnInit } from '@angular/core';
import { jsPDF } from "jspdf";
import { DataAccessService, Invoice } from '../../services/dataAccess.service';
import { CommonModule } from '@angular/common';
import { MenuComponent } from "../menu/menu.component";

@Component({
  selector: 'app-invoice-viewer',
  templateUrl: './invoice-viewer.component.html',
  styleUrls: ['./invoice-viewer.component.css'],
  standalone: true,
  imports: [CommonModule, MenuComponent]
})
export class InvoiceViewerComponent implements OnInit {
  invoices: Invoice[] = [];
  selectedInvoice: Invoice | null = null;
  errorMessage: string = '';
  loading: boolean = false;

  constructor(private dataService: DataAccessService) {}

  ngOnInit(): void {
    this.loadInvoices();
  }

  // Método para cargar las facturas
  loadInvoices(): void {
    this.loading = true;
    this.dataService.obtenerFacturas().subscribe(
      (response) => {
        this.invoices = response.invoices;
        this.loading = false;
      },
      (error) => {
        this.errorMessage = 'Error al cargar las facturas.';
        this.loading = false;
        console.error(error);
      }
    );
  }

  // Método para seleccionar una factura
  selectInvoice(invoice: Invoice): void {
    this.selectedInvoice = invoice;
  }

  // Método para generar el PDF de la factura seleccionada
  generatePDF(): void {
  if (!this.selectedInvoice) return;

  const doc = new jsPDF();

  // Agregar imagen de fondo
  const imgUrl = 'img/LogoNaranjaAplicacionDecolorado.png';
  doc.addImage(imgUrl, 'JPEG', 0, 0, 210, 297); // A4 completo

  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);

  const marginLeft = 10;
  const topMargin = 10;

  // Título y datos de factura
  doc.text("Factura", marginLeft, topMargin);
  doc.text(`Número de factura: ${this.selectedInvoice.InvoiceID}`, marginLeft, topMargin + 10);
  doc.text(`Fecha: ${this.selectedInvoice.Date}`, marginLeft, topMargin + 20);
  doc.text(`Estado: ${this.selectedInvoice.Estado}`, marginLeft, topMargin + 30);

  // Datos del taller (arriba a la derecha)
  const tallerX = 130;
  const tallerY = topMargin;
  doc.text("Taller:", tallerX, tallerY);
  doc.text(`${this.selectedInvoice.WorkshopName}`, tallerX, tallerY + 10);
  doc.text(`${this.selectedInvoice.WorkshopAddress}`, tallerX, tallerY + 20);
  doc.text(`Tel: ${this.selectedInvoice.WorkshopPhone}`, tallerX, tallerY + 30);

  // Datos del vehículo
  doc.text("Detalles del vehículo:", marginLeft, topMargin + 50);
  doc.text(`Marca: ${this.selectedInvoice.Marca}`, marginLeft, topMargin + 60);
  doc.text(`Modelo: ${this.selectedInvoice.Modelo}`, marginLeft, topMargin + 70);
  doc.text(`Año: ${this.selectedInvoice.Anyo}`, marginLeft, topMargin + 80);

  // Separador
  doc.setLineWidth(0.5);
  doc.line(marginLeft, topMargin + 90, 200, topMargin + 90);

  // Detalles de productos/servicios
  const startY = topMargin + 100;
  doc.text("Detalles de los productos/servicios:", marginLeft, startY);

  this.selectedInvoice.items.forEach((item, index) => {
    const yPosition = startY + 10 + index * 10;
    doc.text(
      `${item.Description} - ${item.Quantity} x ${item.UnitPrice} € (IVA: ${item.TaxRate}%) = ${item.Amount} €`,
      marginLeft,
      yPosition
    );
  });

  // Línea separadora antes del total
  const lineY = startY + 10 + this.selectedInvoice.items.length * 10 + 10;
  doc.line(marginLeft, lineY, 200, lineY);

  // Total
  const totalY = lineY + 10;
  doc.text(`Total: ${this.selectedInvoice.TotalAmount} €`, marginLeft, totalY);

  // Guardar PDF
  doc.save(`Factura_${this.selectedInvoice.InvoiceID}.pdf`);
}

}
