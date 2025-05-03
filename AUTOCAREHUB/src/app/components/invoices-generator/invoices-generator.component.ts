import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { DataAccessService } from '../../services/dataAccess.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-invoices-generator',
  standalone: true,
  templateUrl: './invoices-generator.component.html',
  styleUrls: ['./invoices-generator.component.css'],
  imports: [FormsModule,CommonModule],
})
export class InvoicesGeneratorComponent implements OnInit {
  facturas: any[] = [];
  citaId: number | null = null;
  items: any[] = [];
  estado: string = 'Pendiente';

  constructor(private dataAccessService: DataAccessService) {}

  ngOnInit(): void {
    this.obtenerFacturas();
  }

  // Método para obtener todas las facturas del taller
  obtenerFacturas(): void {
    this.dataAccessService.obtenerFacturas().subscribe(
      (response) => {
        if (response.success) {
          this.facturas = response.facturas || [];
        } else {
          console.error('Error al obtener las facturas:', response.message);
        }
      },
      (error) => {
        console.error('Hubo un error al recuperar las facturas', error);
      }
    );
  }

  // Método para crear una nueva factura
  crearFactura(): void {
    if (this.citaId !== null && this.items.length > 0) {
      this.dataAccessService.crearFactura(this.citaId, this.items, this.estado).subscribe(
        (response) => {
          if (response.success) {
            console.log('Factura creada con éxito:', response);
            this.obtenerFacturas();  // Recargar las facturas después de crear una nueva
          } else {
            console.error('Error al crear la factura:', response.message);
          }
        },
        (error) => {
          console.error('Error al crear la factura:', error);
        }
      );
    } else {
      console.error('Debe proporcionar los datos necesarios para la factura.');
    }
  }

  // Método para agregar un ítem a la factura
  agregarItem(descripcion: string, cantidad: number, precio: number): void {
    const item = { descripcion, cantidad, precio };
    this.items.push(item);
  }
}
