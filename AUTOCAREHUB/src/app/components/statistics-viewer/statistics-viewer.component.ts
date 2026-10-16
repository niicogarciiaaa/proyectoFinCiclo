import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  DataAccessService,
  InvoiceStats,
  Invoice,
} from '../../services/dataAccess.service';
import { MenuComponent } from '../menu/menu.component';
import { descargarCsv } from '../../services/csv.util';
import { ExportacionGestorComponent } from '../exportacion-gestor/exportacion-gestor.component';

interface PeriodoIngresos {
  Periodo: string;
  Facturas: number;
  Total: number;
  Cobrado: number;
}

interface PanelAmpliado {
  indicadores: { Clientes: number; Facturas: number; Total: number; TicketMedio: number; PendienteCobro: number };
  ingresos: PeriodoIngresos[];
  servicios: { Servicio: string; Citas: number; Facturado: number }[];
  estados: { [estado: string]: number };
}

interface ResumenResenas {
  Media: number | null;
  Total: number;
  Reparto: { [estrellas: number]: number };
}

@Component({
  selector: 'app-statistics-viewer',
  standalone: true,
  imports: [CommonModule, FormsModule, MenuComponent, ExportacionGestorComponent],
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

  // Dashboard ampliado (llamada nueva stats.php)
  agrupacion: 'dia' | 'semana' | 'mes' = 'mes';
  panel: PanelAmpliado | null = null;
  resenas: ResumenResenas | null = null;
  ultimasResenas: { Rating: number; Comment: string; UserName: string; CreatedAt: string; Service: string }[] = [];
  readonly estadosCita = ['Pendiente', 'Confirmada', 'Finalizada', 'Cancelada'];
  readonly estrellas = [5, 4, 3, 2, 1];

  constructor(private dataAccess: DataAccessService) {
    // Inicializar fechas por defecto (último mes)
    const today = new Date();
    this.endDate = this.toDateStr(today);
    today.setMonth(today.getMonth() - 1);
    this.startDate = this.toDateStr(today);
  }

  ngOnInit() {
    this.loadData();
    this.cargarResenas();
  }

  loadData() {
    if (this.startDate && this.endDate && this.startDate > this.endDate) {
      this.error = 'La fecha inicial no puede ser posterior a la final';
      return;
    }
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

    this.cargarPanel();
  }

  /** Dashboard ampliado: ingresos por periodo, servicios top y citas por estado. */
  cargarPanel() {
    this.dataAccess
      .obtenerEstadisticasAmpliadas(this.startDate, this.endDate, this.agrupacion)
      .subscribe({
        next: (res) => {
          this.panel = res?.success ? res : null;
        },
        error: () => (this.panel = null),
      });
  }

  cargarResenas() {
    this.dataAccess.obtenerResenasTaller().subscribe({
      next: (res) => {
        if (res?.success) {
          this.resenas = res.resumen;
          this.ultimasResenas = (res.reviews || []).slice(0, 5);
        }
      },
      error: () => {},
    });
  }

  onDateChange() {
    this.loadData();
  }

  /** Atajos de rango de fechas. */
  rangoRapido(tipo: 'mes' | 'trimestre' | 'anio') {
    const fin = new Date();
    const inicio = new Date();
    if (tipo === 'mes') inicio.setMonth(inicio.getMonth() - 1);
    if (tipo === 'trimestre') inicio.setMonth(inicio.getMonth() - 3);
    if (tipo === 'anio') inicio.setFullYear(inicio.getFullYear() - 1);
    this.startDate = this.toDateStr(inicio);
    this.endDate = this.toDateStr(fin);
    this.agrupacion = tipo === 'mes' ? 'semana' : 'mes';
    this.loadData();
  }

  /** Altura relativa (0-100 %) de cada barra del gráfico de ingresos. */
  alturaBarra(valor: number): number {
    const max = Math.max(...(this.panel?.ingresos || []).map((p) => p.Total), 0);
    return max > 0 ? Math.max(2, (valor / max) * 100) : 0;
  }

  /** Ancho relativo de la barra de servicios. */
  anchoServicio(citas: number): number {
    const max = Math.max(...(this.panel?.servicios || []).map((s) => s.Citas), 0);
    return max > 0 ? (citas / max) * 100 : 0;
  }

  get totalCitasPanel(): number {
    if (!this.panel) return 0;
    return Object.values(this.panel.estados).reduce((a, b) => a + b, 0);
  }

  porcentajeEstado(estado: string): number {
    const total = this.totalCitasPanel;
    return total > 0 ? ((this.panel?.estados[estado] || 0) / total) * 100 : 0;
  }

  porcentajeEstrellas(n: number): number {
    if (!this.resenas || this.resenas.Total === 0) return 0;
    return ((this.resenas.Reparto[n] || 0) / this.resenas.Total) * 100;
  }

  etiquetaPeriodo(p: string): string {
    if (this.agrupacion === 'mes') {
      const [y, m] = p.split('-');
      return new Date(+y, +m - 1, 1).toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
    }
    if (this.agrupacion === 'dia') {
      return new Date(p + 'T00:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
    }
    return p; // semana ISO: 2026-S41
  }

  // ---------- Exportación CSV ----------

  exportarFacturasCsv() {
    descargarCsv(
      `facturas_${this.startDate}_${this.endDate}.csv`,
      ['Nº factura', 'Fecha', 'Cliente', 'Vehículo', 'Importe (€)', 'Estado'],
      this.invoices.map((i) => [
        i.InvoiceID,
        i.Date,
        i.UserName || i.WorkshopName || '',
        [i.Marca, i.Modelo].filter(Boolean).join(' '),
        Number(i.TotalAmount),
        i.Estado,
      ])
    );
  }

  exportarIngresosCsv() {
    if (!this.panel) return;
    descargarCsv(
      `ingresos_${this.agrupacion}_${this.startDate}_${this.endDate}.csv`,
      ['Periodo', 'Facturas', 'Facturado (€)', 'Cobrado (€)'],
      this.panel.ingresos.map((p) => [p.Periodo, p.Facturas, p.Total, p.Cobrado])
    );
  }

  // ---------- Formato ----------

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount || 0);
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('es-ES');
  }

  getPendingPercentage(): number {
    if (!this.stats || !this.stats.total_facturas) return 0;
    return (this.stats.pendientes / this.stats.total_facturas) * 100;
  }

  private toDateStr(d: Date): string {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${dd}`;
  }
}
