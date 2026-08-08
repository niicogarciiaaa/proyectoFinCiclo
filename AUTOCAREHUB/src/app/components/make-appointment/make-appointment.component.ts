import { Component, OnInit } from '@angular/core';
import { DataAccessService } from '../../services/dataAccess.service';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MenuComponent } from '../menu/menu.component';

interface Slot {
  hora: string;
  estado: string;
  restantes: number;
}

interface Availability {
  [date: string]: Slot[];
}

interface Service {
  ServiceID: number;
  Name: string;
  DurationMinutes: number;
  Price: number | null;
}

@Component({
  selector: 'app-make-appointment',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, MenuComponent],
  templateUrl: './make-appointment.component.html',
  styleUrl: './make-appointment.component.css',
})
export class MakeAppointmentComponent implements OnInit {
  selectedLang: string = 'es';
  errorMessage: string = '';
  vehiclesErrorMessage: string = '';
  monthSlots: Availability = {};
  loading: boolean = false;
  loadingVehicles: boolean = false;
  loadingWorkshops: boolean = false;
  loadingServices: boolean = false;
  selectedSlots: { fecha: string; hora: string }[] = [];
  selectedVehicle: number = 0;
  selectedWorkshop: number = 0;
  selectedService: number = 0; // 0 = sin servicio concreto (duración por defecto)
  motivo: string = '';
  vehicles: any[] = [];
  workshops: any[] = [];
  services: Service[] = [];
  duration: number = 60;
  isPopupVisible = false;

  // Paginación de fechas
  visibleDates: string[] = [];
  currentPage: number = 1;
  datesPerPage: number = 5;
  totalPages: number = 1;

  constructor(private dataAccess: DataAccessService) {}

  ngOnInit(): void {
    this.cargarVehiculos();
    this.cargarTalleres();
  }

  cargarVehiculos() {
    this.loadingVehicles = true;
    this.vehiclesErrorMessage = '';
    this.dataAccess.obtenerVehiculos().subscribe({
      next: (response) => {
        if (response && response.success) {
          this.vehicles = response.vehicles || [];
          if (this.vehicles.length > 0 && !this.selectedVehicle) {
            this.selectedVehicle = this.vehicles[0].VehicleID;
          }
        } else {
          this.vehiclesErrorMessage = 'No se pudieron cargar los vehículos';
        }
      },
      error: () => {
        this.vehiclesErrorMessage = 'Error de conexión al cargar vehículos';
      },
      complete: () => {
        this.loadingVehicles = false;
      },
    });
  }

  cargarTalleres() {
    this.loadingWorkshops = true;
    this.dataAccess.obtenerTalleres().subscribe({
      next: (response) => {
        if (response && response.success) {
          this.workshops = response.workshops || [];
          if (this.workshops.length > 0 && !this.selectedWorkshop) {
            this.selectedWorkshop = this.workshops[0].WorkshopID;
            this.onWorkshopChange();
          }
        } else {
          this.errorMessage = 'No se pudieron cargar los talleres';
        }
      },
      error: () => {
        this.errorMessage = 'Error de conexión al cargar talleres';
      },
      complete: () => {
        this.loadingWorkshops = false;
      },
    });
  }

  /** Carga los servicios activos del taller seleccionado. */
  cargarServicios() {
    if (!this.selectedWorkshop) return;
    this.loadingServices = true;
    this.services = [];
    this.selectedService = 0;
    this.dataAccess.listarServicios(this.selectedWorkshop).subscribe({
      next: (res) => {
        if (res && res.success) {
          this.services = res.services || [];
        }
      },
      error: () => {},
      complete: () => {
        this.loadingServices = false;
      },
    });
  }

  /** Consulta la disponibilidad real según taller y servicio elegido. */
  consultarDisponibilidad() {
    if (!this.selectedWorkshop) {
      this.errorMessage = 'Por favor, selecciona un taller.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.selectedSlots = [];

    const params: any = { WorkshopID: this.selectedWorkshop };
    if (this.selectedService) {
      params.ServiceID = this.selectedService;
    }

    this.dataAccess.consultarDisponibilidad(params).subscribe({
      next: (response) => {
        if (response.success) {
          this.monthSlots = response.availability || {};
          this.duration = response.duration || 60;
          this.setupPagination();
        } else {
          this.errorMessage = response.message || 'Error al consultar la disponibilidad';
        }
      },
      error: () => {
        this.errorMessage = 'Error de conexión al servidor';
      },
      complete: () => {
        this.loading = false;
      },
    });
  }

  setupPagination() {
    const allDates = Object.keys(this.monthSlots).sort();
    this.totalPages = Math.max(1, Math.ceil(allDates.length / this.datesPerPage));
    this.goToPage(1);
  }

  goToPage(page: number) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    const allDates = Object.keys(this.monthSlots).sort();
    const startIndex = (page - 1) * this.datesPerPage;
    this.visibleDates = allDates.slice(startIndex, startIndex + this.datesPerPage);
  }

  prevPage() {
    this.goToPage(this.currentPage - 1);
  }

  nextPage() {
    this.goToPage(this.currentPage + 1);
  }

  toggleSlotSelection(fecha: string, hora: string) {
    const index = this.selectedSlots.findIndex(
      (slot) => slot.fecha === fecha && slot.hora === hora
    );
    if (index > -1) {
      this.selectedSlots.splice(index, 1);
    } else {
      this.selectedSlots.push({ fecha, hora });
    }
  }

  isSelected(fecha: string, hora: string): boolean {
    return this.selectedSlots.some(
      (slot) => slot.fecha === fecha && slot.hora === hora
    );
  }

  crearCitas() {
    if (!this.selectedWorkshop) {
      this.errorMessage = 'Por favor, selecciona un taller.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    let citasProcesadas = 0;
    let citasOk = 0;
    const totalCitas = this.selectedSlots.length;

    this.selectedSlots.forEach((slot) => {
      const cita = {
        Fecha: slot.fecha,
        HoraInicio: slot.hora,
        VehicleID: this.selectedVehicle,
        WorkshopID: this.selectedWorkshop,
        Motivo: this.motivo,
        ServiceID: this.selectedService || null,
      };

      this.dataAccess.crearCita(cita).subscribe({
        next: (response) => {
          citasProcesadas++;
          if (response && response.success) {
            citasOk++;
          } else if (response) {
            this.errorMessage = 'No se pudo crear alguna cita: ' + (response.message || '');
          }
          this.finalizarCreacion(citasProcesadas, totalCitas, citasOk);
        },
        error: (error) => {
          citasProcesadas++;
          this.errorMessage =
            'Error al crear la cita: ' +
            (error.error?.message || error.message || 'Error desconocido');
          this.finalizarCreacion(citasProcesadas, totalCitas, citasOk);
        },
      });
    });
    this.isPopupVisible = false;
  }

  /** Cuando se han procesado todas las citas, refresca y muestra el resultado. */
  private finalizarCreacion(procesadas: number, total: number, ok: number) {
    if (procesadas < total) return;
    this.loading = false;
    this.selectedSlots = [];
    this.motivo = '';
    if (ok === total) {
      this.errorMessage = 'Citas creadas correctamente';
    }
    this.consultarDisponibilidad();
  }

  makeAppointment() {
    if (this.selectedSlots.length === 0) {
      this.errorMessage = 'Por favor, selecciona al menos un horario disponible.';
      return;
    }
    if (!this.selectedVehicle) {
      this.errorMessage = 'Por favor, selecciona un vehículo.';
      return;
    }
    if (!this.motivo) {
      this.errorMessage = 'Por favor, ingresa el motivo de la cita.';
      return;
    }
    this.crearCitas();
  }

  getDayName(date: string): string {
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return days[new Date(date).getDay()];
  }

  showPopup() {
    this.isPopupVisible = true;
  }

  closePopup(event: any) {
    if (
      event.target.classList.contains('popup-overlay') ||
      event.target.classList.contains('close-popup')
    ) {
      this.isPopupVisible = false;
    }
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  /** Al cambiar de taller: recargar servicios y disponibilidad. */
  onWorkshopChange() {
    if (this.selectedWorkshop) {
      this.cargarServicios();
      this.consultarDisponibilidad();
    }
  }

  /** Al cambiar de servicio: recalcular disponibilidad (la duración cambia). */
  onServiceChange() {
    this.consultarDisponibilidad();
  }
}
