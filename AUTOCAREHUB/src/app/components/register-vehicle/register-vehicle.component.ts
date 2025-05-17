import { Component, OnInit } from '@angular/core';
import { DataAccessService } from '../../services/dataAccess.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MenuComponent } from "../menu/menu.component";

@Component({
  selector: 'app-register-vehicle',
  standalone: true,
  imports: [FormsModule, CommonModule, MenuComponent],
  templateUrl: './register-vehicle.component.html',
  styleUrls: ['./register-vehicle.component.css']
})
export class RegisterVehicleComponent implements OnInit {

  marca: string = '';
  modelo: string = '';
  anyo: string = '';
  matricula: string = '';
  mensajeError: string = '';
  mensajeExito: string = '';
  vehiculos: any[] = [];  // Array para almacenar los vehículos del usuario

  constructor(private dataAccessService: DataAccessService) { }

  ngOnInit(): void {
    this.obtenerVehiculos();  // Llamada a la API para obtener los vehículos al iniciar el componente
  }

  // Método que se ejecuta al enviar el formulario
  crearVehiculo() {
    const anyoActual = new Date().getFullYear();

  // Validación de matrícula sin espacios
  if (this.matricula.includes(' ')) {
    this.mensajeError = 'La matrícula no puede contener espacios en blanco.';
    this.mensajeExito = '';
    return;
  }

  // Validación de año no superior al actual
  const anyoNumero = parseInt(this.anyo, 10);
  if (isNaN(anyoNumero) || anyoNumero > anyoActual) {
    this.mensajeError = `El año del vehículo no puede ser mayor que ${anyoActual}.`;
    this.mensajeExito = '';
    return;
  }
    const vehiculo = {
      marca: this.marca,
      modelo: this.modelo,
      anyo: this.anyo,
      matricula: this.matricula
    };

    this.dataAccessService.crearVehiculo(vehiculo).subscribe(
      response => {
        if (response.success) {
          this.mensajeExito = 'Vehículo registrado con éxito';
          this.mensajeError = ''; // Limpiar mensaje de error
          this.obtenerVehiculos(); // Recargar la lista de vehículos
        } else {
          this.mensajeExito = ''; // Limpiar mensaje de éxito
          this.mensajeError = 'Error al registrar el vehículo: ' + response.message;
        }
      },
      error => {
        this.mensajeExito = ''; // Limpiar mensaje de éxito
        this.mensajeError = 'Hubo un error en la comunicación con el servidor';
        console.error('Error al registrar el vehículo:', error);
      }
    );
  }

  // Método para obtener los vehículos del usuario
  obtenerVehiculos() {
    this.dataAccessService.obtenerVehiculos().subscribe(
      response => {
        if (response) {
          console.log('Vehículos obtenidos:', response);
          this.vehiculos = response.vehicles; // Asignamos los vehículos a la propiedad vehiculos
        } else {
          this.mensajeError = 'No se pudieron cargar los vehículos.';
        }
      },
      error => {
        this.mensajeError = 'Hubo un error al obtener los vehículos';
        console.error('Error al obtener los vehículos:', error);
      }
    );
  }
  // Método para eliminar un vehículo
    eliminarVehiculo(id: number) {
    if (confirm('¿Estás seguro de que deseas eliminar este vehículo?')) {
      this.dataAccessService.eliminarVehiculo(id).subscribe({
        next: (response) => {
          if (response.success) {
            this.mensajeExito = 'Vehículo eliminado correctamente';
            this.mensajeError = '';
            // Actualizar la lista de vehículos
            this.obtenerVehiculos();
          } else {
            this.mensajeError = 'No se pudo eliminar el vehículo: ' + response.message;
            this.mensajeExito = '';
          }
        },
        error: (error) => {
          console.error('Error al eliminar el vehículo:', error);
          this.mensajeError = 'Error al eliminar el vehículo';
          this.mensajeExito = '';
        }
      });
    }
  }
}
