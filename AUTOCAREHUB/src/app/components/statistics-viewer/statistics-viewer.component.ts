import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  DataAccessService,
  InvoiceStats,
  Invoice,
} from '../../services/dataAccess.service';
import { MenuComponent } from '../menu/menu.component';

@Component({
  selector: 'app-statistics-viewer',
  standalone: true,
  imports: [CommonModule, FormsModule, MenuComponent],
  templateUrl: './statistics-viewer.component.html',
  styleUrl: './statistics-viewer.component.css',
})
export class StatisticsViewerComponent implements OnInit {
  startDate: string = '';
  endDate: string = '';
  stats: InvoiceStats | null = null;
  invoices: Invoice[] = [];
  loading: boolean = false;
  error: string = '';

  constructor(private dataAccess: DataAccessService) {
    // Inicializar fechas por defecto (último mes)
    const today = new Date();
    this.endDate = today.toISOString().split('T')[0];
    today.setMonth(today.getMonth() - 1);
    this.startDate = today.toISOString().split('T')[0];
  }

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.loading = true;
    this.error = '';

    // Cargar estadísticas
    this.dataAccess
      .obtenerEstadisticasFacturacion(this.startDate, this.endDate)
      .subscribe({
        next: (stats) => {
          this.stats = stats;
          this.loading = false;
        },
        error: (error) => {
          this.error = 'Error al cargar estadísticas';
          this.loading = false;
        },
      });

    // Cargar facturas del período
    this.dataAccess
      .buscarFacturas({
        startDate: this.startDate,
        endDate: this.endDate,
      })
      .subscribe({
        next: (response) => {
          this.invoices = response.invoices;
        },
        error: (error) => {
          this.error = 'Error al cargar facturas';
        },
      });
  }

  onDateChange() {
    this.loadData();
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('es-ES');
  }

  getPendingPercentage(): number {
    if (!this.stats) return 0;
    return (this.stats.pendientes / this.stats.total_facturas) * 100;
  }
}
