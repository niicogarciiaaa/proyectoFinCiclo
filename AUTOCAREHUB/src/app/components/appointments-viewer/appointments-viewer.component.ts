import { Component } from '@angular/core';
import { DataAccessService } from '../../services/dataAccess.service';
import { CommonModule } from '@angular/common';

interface Cita {
  AppointmentID: number;
  UserID: number;
  Vehiculo: string;
  WorkshopID: number;
  Service: string;
  Estado: string;
  StartDateTime: string;
  EndDateTime: string;
  Description: string;
  UserName: string;
}

@Component({
  selector: 'app-appointments-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './appointments-viewer.component.html',
  styleUrl: './appointments-viewer.component.css'
})
export class AppointmentsViewerComponent {
  citas: Cita[] = []; // Inicializado como array vacío
  errorCitas: string = '';
  constructor(private dataAccessService: DataAccessService){}
  
  ngOnInit(): void {
    
  }
  obtenerCitasDelTaller(): void {
    this.dataAccessService.obtenerCitasTaller().subscribe({
      next: (respuesta) => {
        if (respuesta) {
          this.citas = respuesta.citas || [];
        } else {
          this.citas = respuesta.message || 'No se pudieron obtener las citas del taller';
        }
      },
      error: (error) => {
        this.errorCitas = error.message || 'Error al obtener las citas';
      }
    });
}
}