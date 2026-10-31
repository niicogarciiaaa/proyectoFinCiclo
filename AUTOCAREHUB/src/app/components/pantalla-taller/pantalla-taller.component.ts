import { Component, ElementRef, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { DataAccessService } from '../../services/dataAccess.service';
import { PasoSeguimiento } from '../../services/seguimiento';
import { cocheConRetraso } from '../workshop-3d/retraso';

interface Tarjeta {
  id: number;
  matricula: string;
  modelo: string;
  servicio: string;
  inicio: string;
  fin: string;
  puesto: string;
  etapa: string;
  retraso: boolean;
}

/**
 * Pantalla para una TV del taller: los coches de hoy en tres columnas (por
 * llegar, en el taller y listos) con su etapa y hora de entrega. Se actualiza
 * sola. No muestra datos del cliente, porque puede estar a la vista de todos.
 */
@Component({
  selector: 'app-pantalla-taller',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './pantalla-taller.component.html',
  styleUrl: './pantalla-taller.component.css',
})
export class PantallaTallerComponent implements OnInit, OnDestroy {
  private readonly REFRESCO_MS = 60_000;
  private datos?: ReturnType<typeof setInterval>;
  private segundero?: ReturnType<typeof setInterval>;

  ahora = new Date();
  nombre = '';
  porLlegar: Tarjeta[] = [];
  enTaller: Tarjeta[] = [];
  listos: Tarjeta[] = [];
  error = '';
  actualizado = false;

  constructor(private dataAccess: DataAccessService, private host: ElementRef<HTMLElement>) {}

  ngOnInit(): void {
    this.cargar();
    this.datos = setInterval(() => this.cargar(), this.REFRESCO_MS);
    this.segundero = setInterval(() => (this.ahora = new Date()), 1000);
  }

  ngOnDestroy(): void {
    clearInterval(this.datos);
    clearInterval(this.segundero);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }

  get fechaLarga(): string {
    return this.ahora.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  pantallaCompleta(): void {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else this.host.nativeElement.requestFullscreen?.().catch(() => {});
  }

  private cargar(): void {
    const hoy = new Date().toLocaleDateString('sv-SE');
    forkJoin({
      taller: this.dataAccess.obtenerTaller3D(hoy),
      seguimiento: this.dataAccess.obtenerResumenSeguimiento().pipe(catchError(() => of(null))),
    }).subscribe({
      next: ({ taller, seguimiento }) => {
        if (!taller?.success) {
          this.error = taller?.message || 'No se pudo cargar el taller';
          return;
        }
        this.error = '';
        this.actualizado = true;
        this.nombre = taller.layout?.nombre || '';
        const pasos: { [id: number]: PasoSeguimiento | undefined } = seguimiento?.seguimiento || {};
        const puestos: any[] = taller.layout?.puestos || [];
        const tarjeta = (c: any): Tarjeta => ({
          id: c.AppointmentID,
          matricula: (c.Matricula || '').toUpperCase(),
          modelo: `${c.Marca} ${c.Modelo}`.trim(),
          servicio: c.Service,
          inicio: (c.StartDateTime || '').substring(11, 16),
          fin: (c.EndDateTime || '').substring(11, 16),
          puesto: puestos.find((p) => p.key === c.BayKey)?.etiqueta || '',
          etapa: pasos[c.AppointmentID]?.StageLabel || '',
          retraso: cocheConRetraso(c),
        });
        const etapa = (c: any) => pasos[c.AppointmentID]?.Stage;
        const esListo = (c: any) => c.Status === 'Finalizada' || etapa(c) === 'listo';
        const coches: any[] = (taller.coches || []).filter((c: any) => etapa(c) !== 'entregado');
        const pendientes: any[] = taller.pendientes || [];
        const porHora = (a: Tarjeta, b: Tarjeta) => a.inicio.localeCompare(b.inicio);

        this.enTaller = coches.filter((c) => !esListo(c)).map(tarjeta).sort(porHora);
        this.listos = [...coches, ...pendientes].filter(esListo).map(tarjeta).sort(porHora);
        this.porLlegar = pendientes.filter((c) => !esListo(c) && etapa(c) !== 'entregado').map(tarjeta).sort(porHora);
      },
      error: (e) => (this.error = e.message || 'No se pudo cargar el taller'),
    });
  }
}
