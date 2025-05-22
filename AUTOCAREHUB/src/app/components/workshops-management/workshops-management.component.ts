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
  newWorkshop: Workshop = {
    Name: '',
    Address: '',
    Phone: '',
    Email: '',
    FullName: '',
    Description: '',
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
      !this.newWorkshop.Name ||
      !this.newWorkshop.Address ||
      !this.newWorkshop.Phone ||
      !this.newWorkshop.Email
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
      Name: '',
      Address: '',
      Phone: '',
      Email: '',
      FullName: '',
      Description: '',
    };
  }
}
