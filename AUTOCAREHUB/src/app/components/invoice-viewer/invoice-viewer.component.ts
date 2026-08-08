import { Component, OnInit } from '@angular/core';
import { DataAccessService, Invoice } from '../../services/dataAccess.service';
import { InvoicePdfService } from '../../services/invoice-pdf.service';
import { CommonModule } from '@angular/common';
import { MenuComponent } from '../menu/menu.component';

@Component({
  selector: 'app-invoice-viewer',
  templateUrl: './invoice-viewer.component.html',
  styleUrls: ['./invoice-viewer.component.css'],
  standalone: true,
  imports: [CommonModule, MenuComponent],
})
export class InvoiceViewerComponent implements OnInit {
  invoices: Invoice[] = [];
  selectedInvoice: Invoice | null = null;
  errorMessage: string = '';
  loading: boolean = false;

  constructor(
    private dataService: DataAccessService,
    private invoicePdf: InvoicePdfService
  ) {}

  ngOnInit(): void {
    this.loadInvoices();
  }

  /**Carga las facturas del usuario */
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

  /**Método para seleccionar una factura*/
  selectInvoice(invoice: Invoice): void {
    this.selectedInvoice = invoice;
  }

  /**Método para generar el PDF de la factura seleccionada (con QR VeriFactu si existe)*/
  generatePDF(): void {
    if (!this.selectedInvoice) return;
    const invoice = this.selectedInvoice;
    this.dataService.obtenerVerifactu(invoice.InvoiceID).subscribe({
      next: (res) => this.invoicePdf.generatePDF(invoice, res?.registro ?? null),
      error: () => this.invoicePdf.generatePDF(invoice), // sin registro VeriFactu
    });
  }
}
