import { Component, EventEmitter, HostListener, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataAccessService } from '../../services/dataAccess.service';

/** Datos mínimos de la cita que se quiere mover. */
export interface CitaReprogramable {
  AppointmentID: number;
  WorkshopID: number;
  StartDateTime: string;
  EndDateTime: string;
  Service?: string;
}

interface Slot {
  hora: string;
  estado: string;
  restantes: number;
}

/**
 * Diálogo para reprogramar una cita: muestra los huecos libres del mismo
 * taller (con la duración de la cita) y la mueve al hueco elegido.
 * Lo usan «Mis Citas» (cliente) y la «Agenda Semanal» (taller).
 */
@Component({
  selector: 'app-reschedule-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reschedule-dialog.component.html',
  styleUrl: './reschedule-dialog.component.css',
})
export class RescheduleDialogComponent implements OnInit {
  @Input({ required: true }) cita!: CitaReprogramable;
  /** Se emite con la respuesta del servidor cuando la cita se ha movido. */
  @Output() reprogramada = new EventEmitter<{ StartDateTime: string; EndDateTime: string; Status: string }>();
  @Output() cerrar = new EventEmitter<void>();

  disponibilidad: { [fecha: string]: Slot[] } = {};
  fechas: string[] = [];
  fechaSeleccionada = '';
  horaSeleccionada = '';
  cargando = false;
  guardando = false;
  error = '';

  constructor(private dataAccess: DataAccessService) {}

  get duracionMinutos(): number {
    const ms = new Date(this.cita.EndDateTime.replace(' ', 'T')).getTime() -
      new Date(this.cita.StartDateTime.replace(' ', 'T')).getTime();
    return ms > 0 ? Math.round(ms / 60000) : 60;
  }

  ngOnInit(): void {
    this.cargando = true;
    this.dataAccess.consultarDisponibilidad({
      WorkshopID: this.cita.WorkshopID,
      DurationMinutes: this.duracionMinutos,
    }).subscribe({
      next: (res) => {
        if (res?.success) {
          this.disponibilidad = res.availability || {};
          // Solo días con algún hueco libre.
          this.fechas = Object.keys(this.disponibilidad)
            .sort()
            .filter((f) => this.disponibilidad[f].some((s) => s.estado === 'Disponible'));
          this.fechaSeleccionada = this.fechas[0] || '';
        } else {
          this.error = res?.message || 'No se pudo cargar la disponibilidad';
        }
        this.cargando = false;
      },
      error: (e) => {
        this.error = e.message || 'Error al cargar la disponibilidad';
        this.cargando = false;
      },
    });
  }

  get slotsLibres(): Slot[] {
    return (this.disponibilidad[this.fechaSeleccionada] || []).filter((s) => s.estado === 'Disponible');
  }

  elegirFecha(fecha: string): void {
    this.fechaSeleccionada = fecha;
    this.horaSeleccionada = '';
  }

  confirmar(): void {
    if (!this.fechaSeleccionada || !this.horaSeleccionada) return;
    this.guardando = true;
    this.error = '';
    this.dataAccess
      .reprogramarCita(this.cita.AppointmentID, this.fechaSeleccionada, this.horaSeleccionada)
      .subscribe({
        next: (res) => {
          this.guardando = false;
          if (res?.success) {
            this.reprogramada.emit(res);
          } else {
            this.error = res?.message || 'No se pudo reprogramar la cita';
          }
        },
        error: (e) => {
          this.guardando = false;
          this.error = e.message || 'Error al reprogramar la cita';
        },
      });
  }

  etiquetaFecha(fecha: string): string {
    return new Date(fecha + 'T00:00:00').toLocaleDateString('es-ES', {
      weekday: 'short', day: '2-digit', month: 'short',
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.cerrar.emit();
  }

  cerrarSiFondo(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('ach-modal-overlay')) {
      this.cerrar.emit();
    }
  }
}
