import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataAccessService } from '../../services/dataAccess.service';
import { ETAPAS_SEGUIMIENTO, fechaPaso, indiceEtapa, PasoSeguimiento } from '../../services/seguimiento';

/**
 * (Cliente) Seguimiento de la reparación de una cita, al estilo del
 * seguimiento de un pedido: barra de etapas y, al desplegar, la línea de
 * tiempo con las notas del taller.
 */
@Component({
  selector: 'app-seguimiento-cliente',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './seguimiento-cliente.component.html',
  styleUrl: './seguimiento-cliente.component.css',
})
export class SeguimientoClienteComponent {
  @Input({ required: true }) appointmentId!: number;
  /** Última etapa (del resumen); el detalle se pide al desplegar. */
  @Input({ required: true }) actual!: PasoSeguimiento;

  readonly etapas = ETAPAS_SEGUIMIENTO;
  readonly fecha = fechaPaso;
  abierto = false;
  historial: PasoSeguimiento[] | null = null;
  error = '';

  constructor(private dataAccess: DataAccessService) {}

  get indiceActual(): number {
    return indiceEtapa(this.actual?.Stage);
  }

  get icono(): string {
    return this.etapas[this.indiceActual]?.icono ?? 'bi-tools';
  }

  alternar(): void {
    this.abierto = !this.abierto;
    if (this.abierto) {
      // Se vuelve a pedir cada vez para ver las últimas novedades del taller.
      this.dataAccess.obtenerHistorialSeguimiento(this.appointmentId).subscribe({
        next: (res) => (this.historial = res?.historial || []),
        error: (e) => (this.error = e.message || 'No se pudo cargar el seguimiento'),
      });
    }
  }
}
