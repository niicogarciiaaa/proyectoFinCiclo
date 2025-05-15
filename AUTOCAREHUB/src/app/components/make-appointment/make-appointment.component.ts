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
  styleUrl: './make-appointment.component.css'
})
export class MakeAppointmentComponent implements OnInit {
  selectedLang: string = 'es';
  appointmentForm: any;
  errorMessage: string = '';
  vehiclesErrorMessage: string = '';
  monthSlots: WeekSlots = {};
  loading: boolean = false;
  loadingVehicles: boolean = false;
  selectedSlots: { fecha: string, hora: string }[] = [];
  selectedVehicle: number = 0;
  motivo: string = '';
  vehicles: any[] = [];
  
  // Pagination properties
  visibleDates: string[] = [];
  currentPage: number = 1;
  datesPerPage: number = 5;
  totalPages: number = 1;

  constructor(private dataAccess: DataAccessService) {}

  ngOnInit(): void {
    this.consultarMes();
    this.cargarVehiculos();
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
      error: (error) => {
        this.vehiclesErrorMessage = 'Error de conexión al cargar vehículos';
      },
      complete: () => {
        this.loadingVehicles = false;
      }
    });
  }

  consultarMes() {
    this.loading = true;
    this.errorMessage = '';
    
    // El backend ya maneja la consulta de un mes entero
    const today = new Date();
    const currentDate = today.toISOString().split('T')[0];
    
    this.dataAccess.consultarSemana(1, currentDate, '').subscribe({
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
      }
    });
  }

  setupPagination() {
    const allDates = Object.keys(this.monthSlots).sort();
    this.totalPages = Math.ceil(allDates.length / this.datesPerPage);
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
    const index = this.selectedSlots.findIndex(slot => slot.fecha === fecha && slot.hora === hora);
    if (index > -1) {
      this.selectedSlots.splice(index, 1);
    } else {
      this.selectedSlots.push({ fecha, hora });
    }
  }

  isSelected(fecha: string, hora: string): boolean {
    return this.selectedSlots.some(slot => slot.fecha === fecha && slot.hora === hora);
  }

  crearCitas() {
    this.loading = true;
    this.errorMessage = '';
    let citasCreadas = 0;
    const totalCitas = this.selectedSlots.length;
  
    this.selectedSlots.forEach(slot => {
      const cita = {
        Fecha: slot.fecha,
        HoraInicio: slot.hora,
        VehicleID: this.selectedVehicle,
        WorkshopID: 1,
        Motivo: this.motivo
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
            this.errorMessage = 'No se pudo crear la cita: ' + (response?.message || '');
          }
        },
        error: (error) => {
          this.errorMessage = 'Error al crear la cita: ' + (error.error?.message || error.message || 'Error desconocido');
        },
        complete: () => {
          this.loading = false;
        }
      });
    });
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
    const dayIndex = new Date(date).getDay();
    return days[dayIndex];
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }
}