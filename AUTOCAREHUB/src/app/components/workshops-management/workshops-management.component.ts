import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DataAccessService, Workshop } from '../../services/dataAccess.service';
import { I18nService } from '../../services/i18n.service';
import { MenuComponent } from '../menu/menu.component';

@Component({
  selector: 'app-workshops-management',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, MenuComponent],
  templateUrl: './workshops-management.component.html',
  styleUrls: ['./workshops-management.component.css']
})
export class WorkshopsManagementComponent implements OnInit {
  workshops: Workshop[] = [];
  newWorkshop: Workshop = {
    Name: '',
    Address: '',
    Phone: '',
    Description: '',
    Email: '',
    FullName: ''
  };
  editingWorkshop: Workshop | null = null;
  errorMessage: string = '';
  successMessage: string = '';
  isEditing: boolean = false;

  constructor(
    private dataAccess: DataAccessService,
    public i18n: I18nService
  ) { }

  ngOnInit(): void {
    this.loadWorkshops();
  }

  loadWorkshops(): void {
    this.dataAccess.obtenerTalleres().subscribe({
      next: (response) => {
        if (response.success) {
          this.workshops = response.workshops;
          this.errorMessage = '';
        } else {
          this.errorMessage = response.message || 'Error al cargar los talleres';
        }
      },
      error: (error) => {
        console.error('Error al cargar talleres:', error);
        this.errorMessage = 'Error al cargar los talleres';
      }
    });
  }

  createWorkshop(): void {
    if (!this.validateWorkshopData(this.newWorkshop)) {
      return;
    }

    this.dataAccess.createWorkshop(this.newWorkshop).subscribe({
      next: (response) => {
        if (response.success) {
          this.successMessage = 'Taller creado exitosamente';
          this.errorMessage = '';
          this.loadWorkshops();
          this.resetForm();
        } else {
          this.errorMessage = response.message || 'Error al crear el taller';
          this.successMessage = '';
        }
      },
      error: (error) => {
        console.error('Error al crear taller:', error);
        this.errorMessage = 'Error al crear el taller';
        this.successMessage = '';
      }
    });
  }

  startEditing(workshop: Workshop): void {
    this.editingWorkshop = { ...workshop };
    this.isEditing = true;
  }

  updateWorkshop(): void {
    if (!this.editingWorkshop || !this.validateWorkshopData(this.editingWorkshop)) {
      return;
    }

    this.dataAccess.updateWorkshop(this.editingWorkshop).subscribe({
      next: (response) => {
        if (response.success) {
          this.successMessage = 'Taller actualizado exitosamente';
          this.errorMessage = '';
          this.loadWorkshops();
          this.cancelEditing();
        } else {
          this.errorMessage = response.message || 'Error al actualizar el taller';
          this.successMessage = '';
        }
      },
      error: (error) => {
        console.error('Error al actualizar taller:', error);
        this.errorMessage = 'Error al actualizar el taller';
        this.successMessage = '';
      }
    });
  }

  cancelEditing(): void {
    this.editingWorkshop = null;
    this.isEditing = false;
    this.errorMessage = '';
    this.successMessage = '';
  }

  private resetForm(): void {
    this.newWorkshop = {
      Name: '',
      Address: '',
      Phone: '',
      Description: '',
      Email: '',
      FullName: ''
    };
  }

  private validateWorkshopData(workshop: Workshop): boolean {
    if (!workshop.Name || !workshop.Address || !workshop.Phone || !workshop.Email || !workshop.FullName) {
      this.errorMessage = 'Por favor, completa todos los campos requeridos';
      return false;
    }

    const phoneRegex = /^\d{9}$/;
    if (!phoneRegex.test(workshop.Phone)) {
      this.errorMessage = 'El número de teléfono debe tener 9 dígitos';
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(workshop.Email)) {
      this.errorMessage = 'El correo electrónico no es válido';
      return false;
    }

    return true;
  }
}
