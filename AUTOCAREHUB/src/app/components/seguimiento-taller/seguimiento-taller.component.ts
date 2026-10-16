import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataAccessService } from '../../services/dataAccess.service';
import { ETAPAS_SEGUIMIENTO, fechaPaso, indiceEtapa, PasoSeguimiento } from '../../services/seguimiento';

/**
 * (Taller) Editor del seguimiento de una cita: muestra la etapa actual y la
 * línea de tiempo, y permite pasar a otra etapa con una nota o deshacer la
 * última. Se usa en la ficha del Taller 3D y en «Ver citas».
 */
@Component({
  selector: 'app-seguimiento-taller',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './seguimiento-taller.component.html',
  styleUrl: './seguimiento-taller.component.css',
})
export class SeguimientoTallerComponent implements OnChanges {
  @Input({ required: true }) appointmentId!: number;
  /** Estado de la cita: si está cancelada no se puede actualizar. */
  @Input() estadoCita = '';
  /** Avisa al padre de la etapa actual tras cada cambio (null si no hay). */
  @Output() cambiado = new EventEmitter<PasoSeguimiento | null>();

  readonly etapas = ETAPAS_SEGUIMIENTO;
  readonly fecha = fechaPaso;
  historial: PasoSeguimiento[] = [];
  etapaNueva = '';
  nota = '';
  cargando = false;
  guardando = false;
  error = '';

  constructor(private dataAccess: DataAccessService) {}

  ngOnChanges(): void {
    this.cargar();
  }

  get actual(): PasoSeguimiento | null {
    return this.historial.length ? this.historial[this.historial.length - 1] : null;
  }

  get indiceActual(): number {
    return indiceEtapa(this.actual?.Stage);
  }

  get cancelada(): boolean {
    return this.estadoCita === 'Cancelada';
  }

  cargar(): void {
    if (!this.appointmentId) return;
    this.cargando = true;
    this.error = '';
    this.dataAccess.obtenerHistorialSeguimiento(this.appointmentId).subscribe({
      next: (res) => {
        this.cargando = false;
        this.aplicar(res?.historial || [], false);
      },
      error: (e) => {
        this.cargando = false;
        this.error = e.message || 'No se pudo cargar el seguimiento';
      },
    });
  }

  guardar(): void {
    if (!this.etapaNueva || this.guardando) return;
    this.guardando = true;
    this.error = '';
    this.dataAccess.avanzarSeguimiento(this.appointmentId, this.etapaNueva, this.nota.trim()).subscribe({
      next: (res) => {
        this.guardando = false;
        this.nota = '';
        this.aplicar(res?.historial || [], true);
      },
      error: (e) => {
        this.guardando = false;
        this.error = e.message || 'No se pudo guardar la etapa';
      },
    });
  }

  deshacer(): void {
    if (!this.actual || !confirm(`¿Quitar la etapa «${this.actual.StageLabel}»?`)) return;
    this.dataAccess.deshacerSeguimiento(this.appointmentId).subscribe({
      next: (res) => this.aplicar(res?.historial || [], true),
      error: (e) => (this.error = e.message || 'No se pudo deshacer'),
    });
  }

  /** Guarda el historial y propone como siguiente etapa la que va detrás de la actual. */
  private aplicar(historial: PasoSeguimiento[], avisar: boolean): void {
    this.historial = historial;
    const siguiente = this.etapas[Math.min(this.indiceActual + 1, this.etapas.length - 1)];
    this.etapaNueva = siguiente.clave;
    if (avisar) this.cambiado.emit(this.actual);
  }
}
