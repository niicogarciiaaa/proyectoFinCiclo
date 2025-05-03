import { Component, OnInit } from '@angular/core';
import { DataAccessService } from '../../services/dataAccess.service';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

interface WeekSlots {
  [key: string]: {
    hora: string;
    estado: string;
  }[];
}

@Component({
  selector: 'app-make-appointment',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './make-appointment.component.html',
  styleUrl: './make-appointment.component.css'
})
export class MakeAppointmentComponent implements OnInit {
  selectedLang: string = 'es';
  appointmentForm: any;
  errorMessage: string = '';
  vehiclesErrorMessage: string = '';
  weekSlots: WeekSlots = {};
  loading: boolean = false;
  loadingVehicles: boolean = false;
  selectedSlots: { fecha: string, hora: string }[] = [];
  selectedVehicle: number = 0;
  motivo: string = '';
  vehicles: any[] = [];

  constructor(private dataAccess: DataAccessService) {}

  ngOnInit(): void {
    this.consultarSemana();
    this.cargarVehiculos();
  }

  cargarVehiculos() {
    this.loadingVehicles = true;
    this.vehiclesErrorMessage = '';
    
    this.dataAccess.obtenerVehiculos().subscribe({
      next: (response) => {
        if (response && response.success) {
          this.vehicles = response.vehicles || [];
          console.log('Vehículos cargados:', this.vehicles);
          if (this.vehicles.length > 0 && !this.selectedVehicle) {
            this.selectedVehicle = this.vehicles[0].VehicleID;
          }
        } else {
          this.vehiclesErrorMessage = 'No se pudieron cargar los vehículos';
        }
      },
      error: (error) => {
        this.vehiclesErrorMessage = 'Error de conexión al cargar vehículos';
        console.error('Error al cargar vehículos:', error);
      },
      complete: () => {
        this.loadingVehicles = false;
      }
    });
  }

  consultarSemana() {
    this.loading = true;
    const today = new Date();
    const currentDay = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - currentDay + (currentDay === 0 ? -6 : 1));
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    const fechaInicio = monday.toISOString().split('T')[0];
    const fechaFin = friday.toISOString().split('T')[0];

    this.dataAccess.consultarSemana(1, fechaInicio, fechaFin).subscribe({
      next: (response) => {
        if (response.success) {
          this.weekSlots = response.slotsSemana;
        } else {
          this.errorMessage = 'Error al consultar los huecos disponibles';
        }
      },
      error: (error) => {
        this.errorMessage = 'Error de conexión al servidor';
        console.error('Error:', error);
      },
      complete: () => {
        this.loading = false;
      }
    });
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
        HoraFin: this.calculateEndTime(slot.hora),
        VehicleID: this.selectedVehicle, // Cambiar de VehiculoID a VehicleID
        WorkshopID: 1,
        Motivo: this.motivo
      };
  
      this.dataAccess.crearCita(cita).subscribe({
        next: (response) => {
          if (response && response.success) {
            citasCreadas++;
            if (citasCreadas === totalCitas) {
              this.consultarSemana();
              this.selectedSlots = [];
              this.motivo = '';
              this.errorMessage = 'Citas creadas correctamente';
              console.log('Datos de la cita:', cita);
            }
          } else {
            this.errorMessage = 'No se pudo crear la cita: ' + (response?.message || '');
          }
        },
        error: (error) => {
          this.errorMessage = 'Error al crear la cita: ' + (error.error?.message || error.message || 'Error desconocido');
          console.error('Error al crear la cita:', error);
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

  calculateEndTime(startTime: string): string {
    const [hours, minutes] = startTime.split(':').map(Number);
    let endMinutes = minutes + 30;
    let endHours = hours;

    if (endMinutes >= 60) {
      endHours += 1;
      endMinutes -= 60;
    }

    return `${endHours}:${endMinutes < 10 ? '0' : ''}${endMinutes}`;
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
