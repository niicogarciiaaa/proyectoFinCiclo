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

    console.log('Citas seleccionadas:', this.selectedSlots);
    // Aquí podrías hacer una llamada al backend para guardar las citas
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
