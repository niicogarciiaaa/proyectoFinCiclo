import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataAccessService } from '../../services/dataAccess.service';
import { I18nService } from '../../services/i18n.service';
import { MenuComponent } from '../menu/menu.component';

interface ScheduleDay {
  DayOfWeek: number;
  IsOpen: boolean;
  OpenTime: string;
  CloseTime: string;
  BreakStart: string | null;
  BreakEnd: string | null;
  Capacity: number;
  SlotMinutes: number;
}

interface Service {
  ServiceID: number;
  WorkshopID: number;
  Name: string;
  DurationMinutes: number;
  Price: number | null;
  IsActive: boolean;
}

/**
 * Configuración de la Agenda Inteligente del taller:
 *  - Horario semanal (apertura/cierre, descanso, capacidad y rejilla por día).
 *  - Catálogo de servicios con su duración estimada.
 */
@Component({
  selector: 'app-agenda-config',
  standalone: true,
  imports: [CommonModule, FormsModule, MenuComponent],
  templateUrl: './agenda-config.component.html',
  styleUrl: './agenda-config.component.css',
})
export class AgendaConfigComponent implements OnInit {
  dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  slotOptions = [15, 20, 30, 45, 60, 90, 120];

  schedule: ScheduleDay[] = [];
  services: Service[] = [];

  loading = false;
  savingSchedule = false;
  message = '';
  isError = false;

  // Formulario para crear/editar un servicio.
  editingService: Service | null = null;
  serviceForm: { Name: string; DurationMinutes: number; Price: number | null; IsActive: boolean } = {
    Name: '',
    DurationMinutes: 60,
    Price: null,
    IsActive: true,
  };

  // VeriFactu: datos fiscales del emisor y estado de la cadena.
  emisor: { NIF: string; RazonSocial: string } = { NIF: '', RazonSocial: '' };
  cadenaInfo: string = '';

  constructor(private dataAccess: DataAccessService, public i18n: I18nService) {}

  ngOnInit(): void {
    this.cargarConfig();
    this.cargarEmisor();
  }

  // ---------------- VeriFactu ----------------

  cargarEmisor(): void {
    this.dataAccess.obtenerEmisorVerifactu().subscribe({
      next: (res) => {
        if (res && res.success && res.emisor) {
          this.emisor = { NIF: res.emisor.NIF, RazonSocial: res.emisor.RazonSocial };
        }
      },
      error: () => {},
    });
  }

  guardarEmisor(): void {
    if (!this.emisor.NIF.trim() || !this.emisor.RazonSocial.trim()) {
      this.mostrarMensajePublic('NIF y razón social son obligatorios', true);
      return;
    }
    this.dataAccess.guardarEmisorVerifactu(this.emisor.NIF, this.emisor.RazonSocial).subscribe({
      next: (res) => this.mostrarMensajePublic(res?.message || 'Guardado', !res?.success),
      error: () => this.mostrarMensajePublic('Error al guardar los datos fiscales', true),
    });
  }

  verificarCadena(): void {
    this.cadenaInfo = '';
    this.dataAccess.verificarCadenaVerifactu().subscribe({
      next: (res) => {
        if (!res?.success) {
          this.cadenaInfo = '⚠️ ' + (res?.message || 'No se pudo verificar');
          return;
        }
        this.cadenaInfo = res.integra
          ? `✓ Cadena íntegra (${res.total} registro(s) verificados).`
          : `✗ Cadena ROTA a partir de la factura #${res.rota_en_factura}.`;
      },
      error: () => (this.cadenaInfo = '⚠️ Error al verificar la cadena'),
    });
  }

  private mostrarMensajePublic(msg: string, isError: boolean): void {
    this.message = msg;
    this.isError = isError;
    setTimeout(() => (this.message = ''), 4000);
  }

  cargarConfig(): void {
    this.loading = true;
    this.dataAccess.obtenerConfigAgenda().subscribe({
      next: (res) => {
        if (res && res.success) {
          this.schedule = (res.schedule || []).map((d: any) => ({
            DayOfWeek: d.DayOfWeek,
            IsOpen: !!d.IsOpen,
            OpenTime: d.OpenTime || '09:00',
            CloseTime: d.CloseTime || '18:00',
            BreakStart: d.BreakStart || '',
            BreakEnd: d.BreakEnd || '',
            Capacity: d.Capacity || 1,
            SlotMinutes: d.SlotMinutes || 30,
          }));
          this.services = res.services || [];
        } else {
          this.mostrarMensaje(res?.message || 'No se pudo cargar la configuración', true);
        }
      },
      error: () => this.mostrarMensaje('Error de conexión al cargar la configuración', true),
      complete: () => (this.loading = false),
    });
  }

  guardarHorario(): void {
    // Validación rápida en cliente antes de enviar.
    for (const d of this.schedule) {
      if (d.IsOpen && d.OpenTime >= d.CloseTime) {
        this.mostrarMensaje(
          `En ${this.dayNames[d.DayOfWeek - 1]} la apertura debe ser anterior al cierre`,
          true
        );
        return;
      }
    }

    this.savingSchedule = true;
    const payload = this.schedule.map((d) => ({
      ...d,
      BreakStart: d.BreakStart || null,
      BreakEnd: d.BreakEnd || null,
    }));

    this.dataAccess.guardarConfigAgenda(payload).subscribe({
      next: (res) => {
        if (res && res.success) {
          this.mostrarMensaje('Horario guardado correctamente', false);
        } else {
          this.mostrarMensaje(res?.message || 'No se pudo guardar el horario', true);
        }
      },
      error: () => this.mostrarMensaje('Error de conexión al guardar el horario', true),
      complete: () => (this.savingSchedule = false),
    });
  }

  /** Copia el horario del primer día a todos los días abiertos (atajo cómodo). */
  copiarALaSemana(origen: ScheduleDay): void {
    this.schedule.forEach((d) => {
      d.OpenTime = origen.OpenTime;
      d.CloseTime = origen.CloseTime;
      d.BreakStart = origen.BreakStart;
      d.BreakEnd = origen.BreakEnd;
      d.Capacity = origen.Capacity;
      d.SlotMinutes = origen.SlotMinutes;
    });
    this.mostrarMensaje('Horario copiado a todos los días (recuerda guardar)', false);
  }

  // ---------------- Servicios ----------------

  nuevoServicio(): void {
    this.editingService = null;
    this.serviceForm = { Name: '', DurationMinutes: 60, Price: null, IsActive: true };
  }

  editarServicio(s: Service): void {
    this.editingService = s;
    this.serviceForm = {
      Name: s.Name,
      DurationMinutes: s.DurationMinutes,
      Price: s.Price,
      IsActive: s.IsActive,
    };
  }

  guardarServicio(): void {
    if (!this.serviceForm.Name.trim()) {
      this.mostrarMensaje('El nombre del servicio es obligatorio', true);
      return;
    }
    if (this.serviceForm.DurationMinutes < 5) {
      this.mostrarMensaje('La duración mínima es de 5 minutos', true);
      return;
    }

    const onDone = () => {
      this.cargarConfig();
      this.nuevoServicio();
    };

    if (this.editingService) {
      this.dataAccess
        .actualizarServicio({ ServiceID: this.editingService.ServiceID, ...this.serviceForm })
        .subscribe({
          next: (res) => {
            this.mostrarMensaje(res?.message || 'Servicio actualizado', !res?.success);
            if (res?.success) onDone();
          },
          error: () => this.mostrarMensaje('Error al actualizar el servicio', true),
        });
    } else {
      this.dataAccess.crearServicio(this.serviceForm).subscribe({
        next: (res) => {
          this.mostrarMensaje(res?.message || 'Servicio creado', !res?.success);
          if (res?.success) onDone();
        },
        error: () => this.mostrarMensaje('Error al crear el servicio', true),
      });
    }
  }

  eliminarServicio(s: Service): void {
    if (!confirm(`¿Eliminar el servicio "${s.Name}"?`)) return;
    this.dataAccess.eliminarServicio(s.ServiceID).subscribe({
      next: (res) => {
        this.mostrarMensaje(res?.message || 'Servicio eliminado', !res?.success);
        if (res?.success) this.cargarConfig();
      },
      error: () => this.mostrarMensaje('Error al eliminar el servicio', true),
    });
  }

  cancelarEdicion(): void {
    this.nuevoServicio();
  }

  private mostrarMensaje(msg: string, isError: boolean): void {
    this.message = msg;
    this.isError = isError;
    setTimeout(() => (this.message = ''), 4000);
  }
}
