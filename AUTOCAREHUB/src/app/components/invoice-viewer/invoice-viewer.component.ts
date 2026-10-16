import { Component, OnInit } from '@angular/core';
import { DataAccessService, Invoice } from '../../services/dataAccess.service';
import { InvoicePdfService } from '../../services/invoice-pdf.service';
import { CommonModule } from '@angular/common';
import { MenuComponent } from '../menu/menu.component';
import { SearchBoxComponent } from '../search-box/search-box.component';
import { coincideBusqueda, fechaBuscable } from '../../services/search.util';

@Component({
  selector: 'app-invoice-viewer',
  templateUrl: './invoice-viewer.component.html',
  styleUrls: ['./invoice-viewer.component.css'],
  standalone: true,
  imports: [CommonModule, MenuComponent, SearchBoxComponent],
})
export class InvoiceViewerComponent implements OnInit {
  invoices: Invoice[] = [];
  busqueda = '';
  /** Factura cuyo PDF se está preparando (para deshabilitar su botón). */
  descargando: number | null = null;
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

  get facturasFiltradas(): Invoice[] {
    return this.invoices.filter((f) =>
      coincideBusqueda(this.busqueda, [
        f.InvoiceID, `AUTOCARE-${f.InvoiceID}`, f.WorkshopName, f.Estado,
        f.Estado === 'Pagado' ? 'pagada' : '', f.TotalAmount, fechaBuscable(f.Date),
        f.Marca, f.Modelo,
      ])
    );
  }

  /** Descarga el PDF de una factura (con QR VeriFactu si existe). */
  generatePDF(invoice: Invoice): void {
    this.descargando = invoice.InvoiceID;
    const fin = () => (this.descargando = null);
    this.dataService.obtenerVerifactu(invoice.InvoiceID).subscribe({
      next: (res) => this.invoicePdf.generatePDF(invoice, res?.registro ?? null).finally(fin),
      error: () => this.invoicePdf.generatePDF(invoice).finally(fin), // sin registro VeriFactu
    });
  }
}
