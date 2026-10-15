import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataAccessService } from '../../services/dataAccess.service';
import { MenuComponent } from '../menu/menu.component';
import { descargarCsv } from '../../services/csv.util';

interface EntradaHistorial {
  AppointmentID: number;
  StartDateTime: string;
  EndDateTime: string;
  Service: string;
  Status: string;
  Description: string;
  WorkshopName: string;
  InvoiceID: number | null;
  InvoiceDate: string | null;
  TotalAmount: number | null;
  InvoiceStatus: string | null;
}

/**
 * Historial de mantenimiento por vehículo (cliente): todas las citas del
 * coche con su taller, estado y factura, más un resumen del gasto total.
 */
@Component({
  selector: 'app-vehicle-history',
  standalone: true,
  imports: [CommonModule, FormsModule, MenuComponent],
  templateUrl: './vehicle-history.component.html',
  styleUrl: './vehicle-history.component.css',
})
export class VehicleHistoryComponent implements OnInit {
  vehiculos: any[] = [];
  vehiculoId = 0;
  historial: EntradaHistorial[] = [];
  resumen: { citas: number; finalizadas: number; gastoTotal: number } | null = null;
  vehiculoInfo: any = null;
  loading = false;
  error = '';

  constructor(private dataAccess: DataAccessService) {}

  ngOnInit(): void {
    this.dataAccess.obtenerVehiculos().subscribe({
      next: (res) => {
        this.vehiculos = (res && res.vehicles) || [];
        if (this.vehiculos.length > 0) {
          this.vehiculoId = this.vehiculos[0].VehicleID;
          this.cargarHistorial();
        }
      },
      error: () => (this.error = 'No se pudieron cargar tus vehículos'),
    });
  }

  cargarHistorial(): void {
    if (!this.vehiculoId) return;
    this.loading = true;
    this.error = '';
    this.dataAccess.obtenerHistorialVehiculo(this.vehiculoId).subscribe({
      next: (res) => {
        this.loading = false;
        if (res?.success) {
          this.historial = res.historial || [];
          this.resumen = res.resumen;
          this.vehiculoInfo = res.vehiculo;
        } else {
          this.error = res?.message || 'No se pudo cargar el historial';
        }
      },
      error: (e) => {
        this.loading = false;
        this.error = e.message || 'Error al cargar el historial';
      },
    });
  }

  exportarCsv(): void {
    const nombre = this.vehiculoInfo
      ? `${this.vehiculoInfo.Marca}_${this.vehiculoInfo.Modelo}_${this.vehiculoInfo.Matricula}`
      : 'vehiculo';
    descargarCsv(
      `historial_${nombre}.csv`,
      ['Fecha', 'Servicio', 'Taller', 'Estado', 'Factura', 'Importe (€)', 'Estado factura', 'Descripción'],
      this.historial.map((h) => [
        h.StartDateTime.substring(0, 16),
        h.Service,
        h.WorkshopName,
        h.Status,
        h.InvoiceID ?? '',
        h.TotalAmount ?? '',
        h.InvoiceStatus ?? '',
        h.Description ?? '',
      ])
    );
  }

  formatFecha(dt: string): string {
    return new Date(dt.replace(' ', 'T')).toLocaleDateString('es-ES', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  }

  formatMoneda(n: number): string {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);
  }

  statusClass(status: string): string {
    switch (status) {
      case 'Confirmada': return 'st-confirmada';
      case 'Finalizada': return 'st-finalizada';
      case 'Cancelada': return 'st-cancelada';
      default: return 'st-pendiente';
    }
  }
}
