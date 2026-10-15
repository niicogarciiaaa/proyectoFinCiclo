import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataAccessService } from '../../services/dataAccess.service';
import { MenuComponent } from '../menu/menu.component';
import { RescheduleDialogComponent } from '../reschedule-dialog/reschedule-dialog.component';

interface MiCita {
  AppointmentID: number;
  StartDateTime: string;
  EndDateTime: string;
  Service: string;
  Status: string;
  Description: string;
  WorkshopID: number;
  VehicleID: number;
  ServiceID: number | null;
  Vehiculo: string;
  WorkshopName: string;
  WorkshopAddress: string;
  WorkshopPhone: string;
  InvoiceID: number | null;
  ReviewRating: number | null;
}

/**
 * Vista "Mis Citas" para el cliente: lista sus citas (próximas y pasadas),
 * permite cancelarlas o reprogramarlas y valorar el taller cuando la cita
 * ha finalizado.
 */
@Component({
  selector: 'app-my-appointments',
  standalone: true,
  imports: [CommonModule, FormsModule, MenuComponent, RescheduleDialogComponent],
  templateUrl: './my-appointments.component.html',
  styleUrl: './my-appointments.component.css',
})
export class MyAppointmentsComponent implements OnInit {
  citas: MiCita[] = [];
  loading = false;
  error = '';
  mensaje = '';
  filtro: 'proximas' | 'todas' = 'proximas';

  /** Cita que se está reprogramando (abre el diálogo). */
  citaAReprogramar: MiCita | null = null;

  /** Cita que se está valorando (abre el formulario de reseña). */
  citaAValorar: MiCita | null = null;
  valoracion = 0;
  comentario = '';
  enviandoValoracion = false;
  readonly estrellas = [1, 2, 3, 4, 5];

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
      error: (err) => {
        this.error = err.message || 'Error al cargar las citas';
        this.loading = false;
      },
      complete: () => (this.loading = false),
    });
  }

  get citasFiltradas(): MiCita[] {
    if (this.filtro === 'todas') return this.citas;
    const ahora = new Date();
    return this.citas.filter((c) => this.fecha(c.EndDateTime) >= ahora);
  }

  /** Citas activas que empiezan en las próximas 48 horas (recordatorio). */
  get recordatorios(): MiCita[] {
    const ahora = Date.now();
    const limite = ahora + 48 * 3600 * 1000;
    return this.citas
      .filter((c) => c.Status === 'Pendiente' || c.Status === 'Confirmada')
      .filter((c) => {
        const t = this.fecha(c.StartDateTime).getTime();
        return t >= ahora && t <= limite;
      })
      .sort((a, b) => a.StartDateTime.localeCompare(b.StartDateTime));
  }

  /** Una cita se puede cancelar si es futura y no está ya finalizada/cancelada. */
  sePuedeCancelar(c: MiCita): boolean {
    return (
      c.Status !== 'Cancelada' &&
      c.Status !== 'Finalizada' &&
      this.fecha(c.StartDateTime) > new Date()
    );
  }

  /** Mismas condiciones que cancelar: solo citas futuras y activas. */
  sePuedeReprogramar(c: MiCita): boolean {
    return this.sePuedeCancelar(c);
  }

  sePuedeValorar(c: MiCita): boolean {
    return c.Status === 'Finalizada' && !c.ReviewRating;
  }

  cancelar(c: MiCita): void {
    if (!confirm('¿Seguro que quieres cancelar esta cita?')) return;
    this.dataAccess.cancelarCita(c.AppointmentID).subscribe({
      next: (res) => {
        if (res && res.success) {
          c.Status = 'Cancelada';
          this.avisar('Cita cancelada correctamente');
        } else {
          this.error = res?.message || 'No se pudo cancelar la cita';
        }
      },
      error: () => (this.error = 'Error al cancelar la cita'),
    });
  }

  // ---------- Reprogramar ----------

  onReprogramada(res: { StartDateTime: string; EndDateTime: string; Status: string }): void {
    if (this.citaAReprogramar && res?.StartDateTime && res?.EndDateTime) {
      this.citaAReprogramar.StartDateTime = res.StartDateTime;
      this.citaAReprogramar.EndDateTime = res.EndDateTime;
      this.citaAReprogramar.Status = res.Status || this.citaAReprogramar.Status;
      this.citas = [...this.citas].sort((a, b) => b.StartDateTime.localeCompare(a.StartDateTime));
    } else {
      this.cargar(); // respuesta incompleta: recargar desde el servidor
    }
    this.citaAReprogramar = null;
    this.avisar('Cita reprogramada. El taller la confirmará de nuevo.');
  }

  // ---------- Valorar ----------

  abrirValoracion(c: MiCita): void {
    this.citaAValorar = c;
    this.valoracion = 0;
    this.comentario = '';
  }

  enviarValoracion(): void {
    const c = this.citaAValorar;
    if (!c || this.valoracion < 1) return;
    this.enviandoValoracion = true;
    this.dataAccess.crearResena(c.AppointmentID, this.valoracion, this.comentario.trim()).subscribe({
      next: (res) => {
        this.enviandoValoracion = false;
        if (res?.success) {
          c.ReviewRating = this.valoracion;
          this.citaAValorar = null;
          this.avisar(res.message || '¡Gracias por tu valoración!');
        } else {
          this.error = res?.message || 'No se pudo guardar la valoración';
        }
      },
      error: (e) => {
        this.enviandoValoracion = false;
        this.error = e.message || 'Error al guardar la valoración';
      },
    });
  }

  // ---------- Presentación ----------

  statusClass(status: string): string {
    switch (status) {
      case 'Confirmada': return 'st-confirmada';
      case 'Finalizada': return 'st-finalizada';
      case 'Cancelada': return 'st-cancelada';
      default: return 'st-pendiente';
    }
  }

  formatFechaHora(dt: string): string {
    const d = this.fecha(dt);
    return d.toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long' }) +
      ' · ' + dt.substring(11, 16);
  }

  hora(dt: string): string {
    return dt.substring(11, 16);
  }

  /** Texto relativo para los recordatorios ("hoy", "mañana"...). */
  cuando(dt: string): string {
    const d = this.fecha(dt);
    const hoy = new Date();
    const manana = new Date();
    manana.setDate(hoy.getDate() + 1);
    if (d.toDateString() === hoy.toDateString()) return 'Hoy';
    if (d.toDateString() === manana.toDateString()) return 'Mañana';
    return d.toLocaleDateString('es-ES', { weekday: 'long' });
  }

  private fecha(dt: string): Date {
    return new Date(dt.replace(' ', 'T'));
  }

  private avisar(msg: string): void {
    this.error = '';
    this.mensaje = msg;
    setTimeout(() => (this.mensaje = ''), 4000);
  }
}
