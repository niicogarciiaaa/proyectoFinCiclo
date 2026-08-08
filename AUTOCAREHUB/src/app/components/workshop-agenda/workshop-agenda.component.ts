import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DataAccessService } from '../../services/dataAccess.service';
import { MenuComponent } from '../menu/menu.component';

interface Cita {
  AppointmentID: number;
  Vehiculo: string;
  ServiceID: number | null;
  Service: string;
  Status: string;
  StartDateTime: string;
  EndDateTime: string;
  Description: string;
  UserName: string;
  InvoiceID: number | null;
}

interface DiaAgenda {
  fecha: Date;
  fechaStr: string;
  citas: Cita[];
}

/**
 * Vista de calendario semanal de la Agenda Inteligente para el taller.
 * Muestra las citas de cada día agrupadas y ordenadas por hora, con
 * navegación entre semanas y colores por estado.
 */
@Component({
  selector: 'app-workshop-agenda',
  standalone: true,
  imports: [CommonModule, MenuComponent],
  templateUrl: './workshop-agenda.component.html',
  styleUrl: './workshop-agenda.component.css',
})
export class WorkshopAgendaComponent implements OnInit {
  dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  semana: DiaAgenda[] = [];
  inicioSemana: Date = this.lunesDe(new Date());
  todasLasCitas: Cita[] = [];
  loading = false;
  error = '';
  mensaje = '';

  constructor(private dataAccess: DataAccessService, private router: Router) {}

  /** Indica si la cita ya tiene una factura asociada. */
  estaFacturada(cita: Cita): boolean {
    return !!cita.InvoiceID;
  }

  /** Lleva al generador de facturas con la cita precargada (borrador). */
  facturar(cita: Cita): void {
    this.router.navigate(['/invoiceGenerator'], {
      queryParams: { appointmentId: cita.AppointmentID },
    });
  }

  ngOnInit(): void {
    this.cargarCitas();
  }

  cargarCitas(): void {
    this.loading = true;
    this.dataAccess.obtenerCitasTallerAgenda().subscribe({
      next: (res) => {
        this.todasLasCitas = (res && res.citas) || [];
        this.construirSemana();
      },
      error: (err) => {
        this.error = err.message || 'Error al obtener las citas';
      },
      complete: () => (this.loading = false),
    });
  }

  /** Reparte las citas en los 7 días de la semana visible. */
  construirSemana(): void {
    this.semana = [];
    for (let i = 0; i < 7; i++) {
      const fecha = new Date(this.inicioSemana);
      fecha.setDate(fecha.getDate() + i);
      const fechaStr = this.toDateStr(fecha);

      const citasDia = this.todasLasCitas
        .filter((c) => c.StartDateTime.substring(0, 10) === fechaStr)
        .sort((a, b) => a.StartDateTime.localeCompare(b.StartDateTime));

      this.semana.push({ fecha, fechaStr, citas: citasDia });
    }
  }

  semanaAnterior(): void {
    this.inicioSemana.setDate(this.inicioSemana.getDate() - 7);
    this.inicioSemana = new Date(this.inicioSemana);
    this.construirSemana();
  }

  semanaSiguiente(): void {
    this.inicioSemana.setDate(this.inicioSemana.getDate() + 7);
    this.inicioSemana = new Date(this.inicioSemana);
    this.construirSemana();
  }

  hoy(): void {
    this.inicioSemana = this.lunesDe(new Date());
    this.construirSemana();
  }

  get rangoSemana(): string {
    const fin = new Date(this.inicioSemana);
    fin.setDate(fin.getDate() + 6);
    return `${this.formatCorto(this.inicioSemana)} – ${this.formatCorto(fin)}`;
  }

  esHoy(fecha: Date): boolean {
    return this.toDateStr(fecha) === this.toDateStr(new Date());
  }

  hora(dt: string): string {
    return dt.substring(11, 16);
  }

  /** Cambia el estado de una cita (confirmar, finalizar, cancelar). */
  cambiarEstado(cita: Cita, nuevoEstado: string): void {
    if (nuevoEstado === 'Cancelada' && !confirm('¿Cancelar esta cita?')) return;
    this.dataAccess.cambiarEstadoCita(cita.AppointmentID, nuevoEstado).subscribe({
      next: (res) => {
        if (res && res.success) {
          cita.Status = nuevoEstado; // actualización optimista
          this.mensaje = 'Cita actualizada a "' + nuevoEstado + '"';
          setTimeout(() => (this.mensaje = ''), 3000);
        } else {
          this.error = res?.message || 'No se pudo cambiar el estado';
        }
      },
      error: () => (this.error = 'Error al cambiar el estado de la cita'),
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

  // ---------- helpers de fecha ----------
  private lunesDe(d: Date): Date {
    const date = new Date(d);
    const day = (date.getDay() + 6) % 7; // 0 = lunes
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - day);
    return date;
  }

  private toDateStr(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }

  private formatCorto(d: Date): string {
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  }
}
