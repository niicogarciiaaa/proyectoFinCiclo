import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { DataAccessService, Invoice } from '../../services/dataAccess.service';
import { MenuComponent } from '../menu/menu.component';
import { AppointmentsViewerComponent } from "../appointments-viewer/appointments-viewer.component";

interface InvoiceItemWorkshop {
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
}

@Component({
  selector: 'app-invoices-generator',
  standalone: true,
  templateUrl: './invoices-generator.component.html',
  styleUrls: ['./invoices-generator.component.css'],
  imports: [FormsModule, CommonModule, MenuComponent],
})
export class InvoicesGeneratorComponent implements OnInit {
  facturas: Invoice[] = [];
  appointment_id: number | null = null;
  items: InvoiceItemWorkshop[] = [];
  estado: string = 'Pendiente';
  citasTaller: any[] = [];
  errorCitas: string = '';
  
  // Campos para el nuevo ítem
  newItemDescription: string = '';
  newItemQuantity: number = 1;
  newItemPrice: number = 0;
  newItemTaxRate: number = 21; // IVA predeterminado
  
  isLoading: boolean = false;
  errorMessage: string = '';
  successMessage: string = '';
  isTaller: boolean = false;

  constructor(private dataAccessService: DataAccessService) {}

  ngOnInit(): void {
    this.obtenerFacturas();

    
    // Comprobar si el usuario es un taller
    const currentUser = this.dataAccessService.getCurrentUser();
    if (currentUser && currentUser.role === 'Taller') {
      this.isTaller = true;
      
    } else {
      console.warn('Este componente está diseñado para usuarios con rol de Taller');
    }
    if (this.isTaller) {
      this.obtenerCitasDelTaller();
    }
    
  }

  /**  Método para obtener todas las facturas */
  obtenerFacturas(): void {
    this.isLoading = true;
    this.errorMessage = '';
    
    this.dataAccessService.obtenerFacturas().subscribe({
      next: (response) => {
        this.facturas = response.invoices || [];
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al obtener las facturas:', error);
        this.errorMessage = error.message || 'Hubo un error al recuperar las facturas';
        this.isLoading = false;
      }
    });
  }

  /**Método para crear una nueva factura */
  crearFactura(): void {
    if (!this.appointment_id) {
      this.errorMessage = 'Debes proporcionar el ID de la cita';
      return;
    }
    
    if (this.items.length === 0) {
      this.errorMessage = 'Debes añadir al menos un ítem a la factura';
      return;
    }
    
    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';
    
    this.dataAccessService.crearFactura(this.appointment_id, this.items, this.estado).subscribe({
      next: (response) => {
        console.log('Respuesta del servidor:', response);
        this.successMessage = 'Factura creada con éxito';
        this.resetForm();
        this.obtenerFacturas(); // Recargar las facturas
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error al crear la factura:', error);
        this.errorMessage = error.message || 'Error al crear la factura';
        this.isLoading = false;
      }
    });
  }

  /**Método para agregar un ítem a la factura*/
  agregarItem(): void {
    if (!this.newItemDescription || this.newItemQuantity <= 0 || this.newItemPrice < 0 || this.newItemTaxRate < 0) {
      this.errorMessage = 'Todos los campos del ítem deben ser válidos.';
      return;
    }
  
    this.items.push({
      description: this.newItemDescription,
      quantity: this.newItemQuantity,
      unit_price: this.newItemPrice,
      tax_rate: this.newItemTaxRate
    });
  
    // Limpiar campos del ítem
    this.newItemDescription = '';
    this.newItemQuantity = 1;
    this.newItemPrice = 0;
    this.newItemTaxRate = 21;
  }
  
  
  /**  Método para eliminar un ítem de la lista */
  eliminarItem(index: number): void {
    this.items.splice(index, 1);
  }
  
  /**Método para calcular el subtotal (sin IVA)*/
  calcularSubtotal(): number {
    return this.items.reduce((total, item) => {
      return total + (item.quantity * item.unit_price);
    }, 0);
  }
  
  /**  Método para calcular el IVA total */
  calcularIVA(): number {
    return this.items.reduce((total, item) => {
      return total + (item.quantity * item.unit_price * (item.tax_rate / 100));
    }, 0);
  }
  
  /**Método para calcular el total con IVA*/
  calcularTotal(): number {
    return this.calcularSubtotal() + this.calcularIVA();
  }
  obtenerCitasDelTaller(): void {
    this.dataAccessService.obtenerCitasTaller().subscribe({
      next: (respuesta) => {
        if (respuesta) {
          this.citasTaller = respuesta.citas || [];
          console.log('Citas del taller:', this.citasTaller);
        } else {
          this.errorCitas = respuesta.message || 'No se pudieron obtener las citas del taller';
        }
      },
      error: (error) => {
        this.errorCitas = error.message || 'Error al obtener las citas';
      }
    });
  }
  
  
  /** Método para resetear el formulario*/
  resetForm(): void {
    this.appointment_id = null;
    this.items = [];
    this.estado = 'Pendiente';
    this.newItemDescription = '';
    this.newItemQuantity = 1;
    this.newItemPrice = 0;
    this.errorMessage = '';
  }
}