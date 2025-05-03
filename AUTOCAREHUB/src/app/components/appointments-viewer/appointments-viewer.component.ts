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

  constructor(private dataAccess: DataAccessService){}
  
  ngOnInit(): void {
    this.dataAccess.obtenerCitasTaller().subscribe({
      next: (data) => {
        if (data.success) {
          this.citas = data.citas;
        }
      },
      error: (err) => console.error('Error al cargar las citas del taller:', err)
    });
  }
}