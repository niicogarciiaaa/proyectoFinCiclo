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
  weekSlots: WeekSlots = {};
  loading: boolean = false;
  selectedSlots: { fecha: string, hora: string }[] = [];
  selectedVehicle: number = 0; // Aquí puedes manejar el vehículo seleccionado
  motivo: string = ''; // Motivo de la cita

  vehicles: any[] = [ { vehicleID: 1, userID:5, marca: 'Toyota', modelo: 'Corolla', anyo: 2020, matricula: 'XYZ1234' },
    { vehicleID: 2, userID: 5, marca: 'Ford', modelo: 'Focus', anyo: 2018, matricula: 'ABC5678' },
    { vehicleID: 3, userID: 5, marca: 'Honda', modelo: 'Civic', anyo: 2022, matricula: 'LMN9101' }
  ]; // Aquí puedes manejar la lista de vehículos
  constructor(private dataAccess: DataAccessService) {}

  ngOnInit(): void {
    this.consultarSemana();
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
          console.log('Huecos de la semana:', this.weekSlots);
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

    // Llamada para crear la cita
    this.selectedSlots.forEach(slot => {
      const cita = {
        Fecha: slot.fecha,
        HoraInicio: slot.hora,
        HoraFin: this.calculateEndTime(slot.hora), // Asegúrate de calcular la hora de fin
        VehiculoID: this.selectedVehicle,
        WorkshopID: 1, // Puedes cambiar esto según lo que necesites
        Motivo: this.motivo
      };

      this.dataAccess.crearCita(cita).subscribe({
        next: (response) => {
          console.log('Respuesta del servidor:', response); // Agrega esta línea para ver la respuesta
          if (response && response.success) {
            console.log('Cita creada con éxito');
            this.errorMessage = '';
          } else {
            this.errorMessage = 'No se pudo crear la cita';
            console.warn('Error al crear la cita:', response?.message);
          }
        },
        error: (error) => {
          this.errorMessage = 'Error al crear la cita';
          console.error('Error al crear la cita:', error);
        }
      });
    });
  }

  calculateEndTime(startTime: string): string {
    const timeParts = startTime.split(':');
    const hours = parseInt(timeParts[0], 10);
    const minutes = parseInt(timeParts[1], 10);
    let endMinutes = minutes + 30; // Asumiendo una duración de 30 minutos para cada cita

    if (endMinutes >= 60) {
      endMinutes -= 60;
      return `${hours + 1}:${endMinutes < 10 ? '0' : ''}${endMinutes}`;
    }

    return `${hours}:${endMinutes < 10 ? '0' : ''}${endMinutes}`;
  }

  changeLang(lang: string) {
    this.selectedLang = lang;
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
