import { Component, OnInit } from '@angular/core';
import { DataAccessService } from '../../services/dataAccess.service';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MenuComponent } from '../menu/menu.component';

interface WeekSlots {
  [key: string]: {
    hora: string;
    estado: string;
  }[];
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
  appointmentForm: any;
  errorMessage: string = '';
  vehiclesErrorMessage: string = '';
  monthSlots: WeekSlots = {};
  loading: boolean = false;
  loadingVehicles: boolean = false;
  loadingWorkshops: boolean = false;
  selectedSlots: { fecha: string; hora: string }[] = [];
  selectedVehicle: number = 0;
  selectedWorkshop: number = 0;
  motivo: string = '';
  vehicles: any[] = [];
  workshops: any[] = [];
  isPopupVisible = false;

  // Pagination properties
  visibleDates: string[] = [];
  currentPage: number = 1;
  datesPerPage: number = 5;
  totalPages: number = 1;

  constructor(private dataAccess: DataAccessService) {}

  /**
   * Inicializa el componente cargando los datos del mes actual, los vehículos y los talleres
   */
  ngOnInit(): void {
    this.cargarVehiculos();
    this.cargarTalleres();
  }

  /**
   * Carga los vehículos del usuario de la sesion
   */
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
      error: (error) => {
        this.vehiclesErrorMessage = 'Error de conexión al cargar vehículos';
      },
      complete: () => {
        this.loadingVehicles = false;
      },
    });
  }

  /**
   * Carga los talleres disponibles
   */
  cargarTalleres() {
    this.loadingWorkshops = true;
    this.dataAccess.obtenerTalleres().subscribe({
      next: (response) => {
        if (response && response.success) {
          this.workshops = response.workshops || [];
          if (this.workshops.length > 0 && !this.selectedWorkshop) {
            this.selectedWorkshop = this.workshops[0].WorkshopID;
            this.consultarMes(); // Ahora se llama aquí, tras seleccionar taller
          }
        } else {
          this.errorMessage = 'No se pudieron cargar los talleres';
        }
      },
      error: (error) => {
        this.errorMessage = 'Error de conexión al cargar talleres';
      },
      complete: () => {
        this.loadingWorkshops = false;
      },
    });
  }

  /**
   * Consulta en la base de datos el estado de las citas de este mes, en función del día actual y el taller seleccionado
   */
  consultarMes() {
    if (!this.selectedWorkshop) {
      this.errorMessage = 'Por favor, selecciona un taller.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    const today = new Date();
    const currentDate = today.toISOString().split('T')[0];

    this.dataAccess
      .consultarSemana(this.selectedWorkshop, currentDate, '')
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.monthSlots = response.slotsSemana;
            this.setupPagination();
          } else {
            this.errorMessage = 'Error al consultar los huecos disponibles';
          }
        },
        error: (error) => {
          this.errorMessage = 'Error de conexión al servidor';
        },
        complete: () => {
          this.loading = false;
        },
      });
  }

  /**
   * Configura la paginación inicial basada en las fechas disponibles
   */
  setupPagination() {
    const allDates = Object.keys(this.monthSlots).sort();
    this.totalPages = Math.ceil(allDates.length / this.datesPerPage);
    this.goToPage(1);
  }

  /**
   * Navega a una página específica de la paginación
   * @param page Número de página a la que se desea navegar
   */
  goToPage(page: number) {
    if (page < 1 || page > this.totalPages) return;

    this.currentPage = page;
    const allDates = Object.keys(this.monthSlots).sort();
    const startIndex = (page - 1) * this.datesPerPage;
    this.visibleDates = allDates.slice(
      startIndex,
      startIndex + this.datesPerPage
    );
  }

  /**
   * Navega a la página anterior
   */
  prevPage() {
    this.goToPage(this.currentPage - 1);
  }

  /**
   * Navega a la página siguiente
   */
  nextPage() {
    this.goToPage(this.currentPage + 1);
  }

  /**
   * Alterna la selección de un horario específico
   * @param fecha Fecha del horario
   * @param hora Hora del horario
   */
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

  /**
   * Verifica si un horario específico está seleccionado
   * @param fecha Fecha del horario
   * @param hora Hora del horario
   * @returns true si el horario está seleccionado, false en caso contrario
   */
  isSelected(fecha: string, hora: string): boolean {
    return this.selectedSlots.some(
      (slot) => slot.fecha === fecha && slot.hora === hora
    );
  }

  /**
   * Crea las citas seleccionadas en el sistema
   */
  crearCitas() {
    if (!this.selectedWorkshop) {
      this.errorMessage = 'Por favor, selecciona un taller.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    let citasCreadas = 0;
    const totalCitas = this.selectedSlots.length;

    this.selectedSlots.forEach((slot) => {
      const cita = {
        Fecha: slot.fecha,
        HoraInicio: slot.hora,
        VehicleID: this.selectedVehicle,
        WorkshopID: this.selectedWorkshop,
        Motivo: this.motivo,
      };

      this.dataAccess.crearCita(cita).subscribe({
        next: (response) => {
          if (response && response.success) {
            citasCreadas++;
            if (citasCreadas === totalCitas) {
              this.consultarMes();
              this.selectedSlots = [];
              this.motivo = '';
              this.errorMessage = 'Citas creadas correctamente';
            }
          } else {
            this.errorMessage =
              'No se pudo crear la cita: ' + (response?.message || '');
          }
        },
        error: (error) => {
          this.errorMessage =
            'Error al crear la cita: ' +
            (error.error?.message || error.message || 'Error desconocido');
        },
        complete: () => {
          this.loading = false;
        },
      });
    });
    this.isPopupVisible = false;
  }

  /**
   * Valida y procesa la creación de una nueva cita
   */
  makeAppointment() {
    if (this.selectedSlots.length === 0) {
      this.errorMessage =
        'Por favor, selecciona al menos un horario disponible.';
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

  /**
   * Obtiene el nombre del día de la semana en español
   * @param date Fecha en formato string
   * @returns Nombre del día en español
   */
  getDayName(date: string): string {
    const days = [
      'Domingo',
      'Lunes',
      'Martes',
      'Miércoles',
      'Jueves',
      'Viernes',
      'Sábado',
    ];
    const dayIndex = new Date(date).getDay();
    return days[dayIndex];
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

  /**
   * Formatea una fecha al formato español (dd/mm/yyyy)
   * @param date Fecha en formato string
   * @returns Fecha formateada en formato español
   */
  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  /**
   * Actualiza los horarios disponibles al cambiar el taller seleccionado
   */
  onWorkshopChange() {
    if (this.selectedWorkshop) {
      this.consultarMes();
    }
  }
}
