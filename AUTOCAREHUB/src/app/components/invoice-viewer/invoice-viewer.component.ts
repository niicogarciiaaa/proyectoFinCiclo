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
    
    // Agregar la imagen de fondo
    const imgUrl = 'img/LogoNaranjaAplicacion.png';  // Ruta de la imagen de fondo
    doc.addImage(imgUrl, 'JPEG', 0, 0, 210, 297);  // Añade la imagen al fondo (A4: 210x297mm)

    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0); // Establece el color del texto

    // Parte superior izquierda: Datos del cliente y vehículo
    const marginLeft = 10;
    const topMargin = 10;

    doc.text("Factura", marginLeft, topMargin);  // Título
    doc.text(`Factura ID: ${this.selectedInvoice.InvoiceID}`, marginLeft, topMargin + 10);
    doc.text(`Fecha: ${this.selectedInvoice.Date}`, marginLeft, topMargin + 20);
    doc.text(`Estado: ${this.selectedInvoice.Estado}`, marginLeft, topMargin + 30);

    // Detalles del vehículo
    doc.text("Detalles del vehículo:", marginLeft, topMargin + 50);
    doc.text(`Marca: ${this.selectedInvoice.Marca}`, marginLeft, topMargin + 60);
    doc.text(`Modelo: ${this.selectedInvoice.Modelo}`, marginLeft, topMargin + 70);
    doc.text(`Año: ${this.selectedInvoice.Anyo}`, marginLeft, topMargin + 80);

    // Separador
    doc.setLineWidth(0.5);
    doc.line(marginLeft, topMargin + 90, 200, topMargin + 90);

    // Espacio entre el separador y los productos/servicios
    const startY = topMargin + 100;
    doc.text("Detalles de los productos/servicios:", marginLeft, startY);

    // Detalles de los productos/servicios
    this.selectedInvoice.items.forEach((item, index) => {
      const yPosition = startY + 10 + index * 10;
      doc.text(`${item.Description} - ${item.Quantity} x ${item.UnitPrice} € (IVA: ${item.TaxRate}%) = ${item.Amount} €`, marginLeft, yPosition);
    });

    // Separador entre los productos y el total
    const lineY = startY + 10 + this.selectedInvoice.items.length * 10 + 10;
    doc.setLineWidth(0.5);
    doc.line(marginLeft, lineY, 200, lineY);

    // Total en la parte inferior
    const totalY = lineY + 10;
    doc.text(`Total: ${this.selectedInvoice.TotalAmount} €`, marginLeft, totalY);

    // Guardar el PDF
    doc.save(`Factura_${this.selectedInvoice.InvoiceID}.pdf`);
  }
}
