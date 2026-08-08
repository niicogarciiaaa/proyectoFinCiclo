import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataAccessService } from '../../services/dataAccess.service';
import { MenuComponent } from '../menu/menu.component';

interface MiCita {
  AppointmentID: number;
  StartDateTime: string;
  EndDateTime: string;
  Service: string;
  Status: string;
  Description: string;
  Vehiculo: string;
  WorkshopName: string;
  WorkshopAddress: string;
  WorkshopPhone: string;
  InvoiceID: number | null;
}

/**
 * Vista "Mis Citas" para el cliente: lista sus citas (próximas y pasadas)
 * y permite cancelar las que aún no se han realizado.
 */
@Component({
  selector: 'app-my-appointments',
  standalone: true,
  imports: [CommonModule, MenuComponent],
  templateUrl: './my-appointments.component.html',
  styleUrl: './my-appointments.component.css',
})
export class MyAppointmentsComponent implements OnInit {
  citas: MiCita[] = [];
  loading = false;
  error = '';
  mensaje = '';
  filtro: 'proximas' | 'todas' = 'proximas';

  constructor(private dataAccess: DataAccessService) {}

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.loading = true;
    this.dataAccess.obtenerMisCitas().subscribe({
      next: (res) => {
        this.citas = (res && res.citas) || [];
      },
      error: (err) => (this.error = err.message || 'Error al cargar las citas'),
      complete: () => (this.loading = false),
    });
  }

  get citasFiltradas(): MiCita[] {
    if (this.filtro === 'todas') return this.citas;
    const ahora = new Date();
    return this.citas.filter((c) => new Date(c.EndDateTime) >= ahora);
  }

  /** Una cita se puede cancelar si es futura y no está ya finalizada/cancelada. */
  sePuedeCancelar(c: MiCita): boolean {
    return (
      c.Status !== 'Cancelada' &&
      c.Status !== 'Finalizada' &&
      new Date(c.StartDateTime) > new Date()
    );
  }

  cancelar(c: MiCita): void {
    if (!confirm('¿Seguro que quieres cancelar esta cita?')) return;
    this.dataAccess.cancelarCita(c.AppointmentID).subscribe({
      next: (res) => {
        if (res && res.success) {
          c.Status = 'Cancelada';
          this.mensaje = 'Cita cancelada correctamente';
          setTimeout(() => (this.mensaje = ''), 3000);
        } else {
          this.error = res?.message || 'No se pudo cancelar la cita';
        }
      },
      error: () => (this.error = 'Error al cancelar la cita'),
    });
  }

  statusClass(status: string): string {
    switch (status) {
      case 'Confirmada': return 'st-confirmada';
      case 'Finalizada': return 'st-finalizada';
      case 'Cancelada': return 'st-cancelada';
      default: return 'st-pendiente';
    }
  }

  formatFechaHora(dt: string): string {
    const d = new Date(dt.replace(' ', 'T'));
    return d.toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long' }) +
      ' · ' + dt.substring(11, 16);
  }

  hora(dt: string): string {
    return dt.substring(11, 16);
  }
}
