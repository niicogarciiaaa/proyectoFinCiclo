import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { DataAccessService, Workshop } from '../../services/dataAccess.service';

@Component({
  selector: 'app-workshops-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './workshops-management.component.html',
  styleUrls: ['./workshops-management.component.css'],
})
export class WorkshopsManagementComponent implements OnInit {
  workshops: Workshop[] = [];
  newWorkshop: any = {
    workshopName: '',
    address: '',
    phone: '',
    email: '',
    fullName: '',
    description: '',
    password: '',
  };
  errorMessage: string = '';
  successMessage: string = '';

  constructor(private dataAccess: DataAccessService) {}

  ngOnInit(): void {
    this.loadWorkshops();
  }

  loadWorkshops(): void {
    this.dataAccess.obtenerTalleres().subscribe({
      next: (response) => {
        if (response.success) {
          this.workshops = response.workshops;
        } else {
          this.errorMessage =
            response.message || 'Error al cargar los talleres';
        }
      },
      error: () => {
        this.errorMessage = 'Error al cargar los talleres';
      },
    });
  }

  createWorkshop(): void {
    if (
      !this.newWorkshop.workshopName ||
      !this.newWorkshop.address ||
      !this.newWorkshop.phone ||
      !this.newWorkshop.email ||
      !this.newWorkshop.fullName ||
      !this.newWorkshop.password
    ) {
      this.errorMessage = 'Por favor, completa todos los campos requeridos';
      return;
    }

    this.dataAccess.createWorkshop(this.newWorkshop).subscribe({
      next: (response) => {
        if (response.success) {
          this.successMessage = 'Taller creado exitosamente';
          this.loadWorkshops();
          this.resetForm();
        } else {
          this.errorMessage = response.message || 'Error al crear el taller';
        }
      },
      error: () => {
        this.errorMessage = 'Error al crear el taller';
      },
    });
  }

  private resetForm(): void {
    this.newWorkshop = {
      workshopName: '',
      address: '',
      phone: '',
      email: '',
      fullName: '',
      description: '',
      password: '',
    };
  }
}
