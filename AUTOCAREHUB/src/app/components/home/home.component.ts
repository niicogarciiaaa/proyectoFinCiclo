import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MenuComponent } from '../menu/menu.component';
import { I18nService } from '../../services/i18n.service';
import { DataAccessService } from '../../services/dataAccess.service';

interface CitaResumen {
  AppointmentID: number;
  StartDateTime: string;
  Service: string;
  Status: string;
  WorkshopName?: string;
  UserName?: string;
  Vehiculo?: string;
}

/**
 * Inicio: bienvenida + resumen personal.
 *  - Cliente: recordatorio de sus próximas citas.
 *  - Taller: citas de hoy y citas pendientes de confirmar.
 */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, MenuComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent implements OnInit {
  rol = '';
  nombre = '';
  proximas: CitaResumen[] = [];
  citasHoy: CitaResumen[] = [];
  pendientesConfirmar = 0;
  cargando = false;

  constructor(public i18n: I18nService, private dataAccess: DataAccessService) {}

  ngOnInit(): void {
    const user = this.dataAccess.getCurrentUser();
    this.rol = String(user?.role ?? '').toLowerCase();
    this.nombre = user?.name ?? '';

    if (this.rol === 'usuario') {
      this.cargando = true;
      this.dataAccess.obtenerMisCitas().subscribe({
        next: (res) => {
          const ahora = new Date();
          this.proximas = ((res && res.citas) || [])
            .filter((c: CitaResumen) => c.Status === 'Pendiente' || c.Status === 'Confirmada')
            .filter((c: CitaResumen) => this.fecha(c.StartDateTime) >= ahora)
            .sort((a: CitaResumen, b: CitaResumen) => a.StartDateTime.localeCompare(b.StartDateTime))
            .slice(0, 3);
          this.cargando = false;
        },
        error: () => (this.cargando = false),
      });
    } else if (this.rol === 'taller') {
      this.cargando = true;
      this.dataAccess.obtenerCitasTallerAgenda().subscribe({
        next: (res) => {
          const citas: CitaResumen[] = (res && res.citas) || [];
          const hoy = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD local
          this.citasHoy = citas
            .filter((c) => c.StartDateTime.substring(0, 10) === hoy && c.Status !== 'Cancelada')
            .sort((a, b) => a.StartDateTime.localeCompare(b.StartDateTime));
          this.pendientesConfirmar = citas.filter(
            (c) => c.Status === 'Pendiente' && this.fecha(c.StartDateTime) >= new Date()
          ).length;
          this.cargando = false;
        },
        error: () => (this.cargando = false),
      });
    }
  }

  formatFechaHora(dt: string): string {
    return this.fecha(dt).toLocaleDateString(this.i18n.currentLang === 'en' ? 'en-GB' : 'es-ES', {
      weekday: 'long', day: 'numeric', month: 'long',
    }) + ' · ' + dt.substring(11, 16);
  }

  hora(dt: string): string {
    return dt.substring(11, 16);
  }

  private fecha(dt: string): Date {
    return new Date(dt.replace(' ', 'T'));
  }
}
