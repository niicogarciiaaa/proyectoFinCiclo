import { Component } from '@angular/core';
import { DataAccessService } from '../../services/dataAccess.service';
import { CommonModule } from '@angular/common';
import { MenuComponent } from '../menu/menu.component';
import { SearchBoxComponent } from '../search-box/search-box.component';
import { SeguimientoTallerComponent } from '../seguimiento-taller/seguimiento-taller.component';
import { PasoSeguimiento } from '../../services/seguimiento';
import { coincideBusqueda, fechaBuscable } from '../../services/search.util';

interface Cita {
  AppointmentID: number;
  UserID: number;
  Vehiculo: string;
  WorkshopID: number;
  Service: string;
  Status: string;
  StartDateTime: string;
  EndDateTime: string;
  Description: string;
  UserName: string;
}

@Component({
  selector: 'app-appointments-viewer',
  standalone: true,
  imports: [CommonModule, MenuComponent, SearchBoxComponent, SeguimientoTallerComponent],
  templateUrl: './appointments-viewer.component.html',
  styleUrl: './appointments-viewer.component.css',
})
export class AppointmentsViewerComponent {
  citas: Cita[] = [];
  busqueda = '';
  /** Última etapa del seguimiento de cada cita (AppointmentID → etapa). */
  seguimiento: { [id: number]: PasoSeguimiento | undefined } = {};
  /** Cita cuyo seguimiento se está editando (abre el diálogo). */
  citaSeguimiento: Cita | null = null;

  cargarSeguimiento(): void {
    this.dataAccessService.obtenerResumenSeguimiento().subscribe({
      next: (res) => (this.seguimiento = res?.seguimiento || {}),
      error: () => (this.seguimiento = {}),
    });
  }

  seguimientoCambiado(id: number, paso: PasoSeguimiento | null): void {
    if (paso) this.seguimiento[id] = paso;
    else delete this.seguimiento[id];
  }

  get citasFiltradas(): Cita[] {
    return this.citas.filter((c) =>
      coincideBusqueda(this.busqueda, [
        c.UserName, c.Vehiculo, c.Service, c.Description, c.Status, fechaBuscable(c.StartDateTime),
      ])
    );
  }
  errorCitas: string = '';
  constructor(private dataAccessService: DataAccessService) {}

  ngOnInit(): void {
    this.obtenerCitasDelTaller();
    this.cargarSeguimiento();
  }
  /**Obtiene las citas del taller,pero solo en caso de ser un taller, y las añade dentro del array */
  obtenerCitasDelTaller(): void {
    this.dataAccessService.obtenerCitasTaller().subscribe({
      next: (respuesta) => {
        if (respuesta) {
          this.citas = respuesta.citas || [];
        } else {
          this.citas =
            respuesta.message || 'No se pudieron obtener las citas del taller';
        }
      },
      error: (error) => {
        this.errorCitas = error.message || 'Error al obtener las citas';
      },
    });
  }
}
