import { Component, OnInit } from '@angular/core';
import { DataAccessService } from '../../services/dataAccess.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MenuComponent } from '../menu/menu.component';

@Component({
  selector: 'app-register-vehicle',
  standalone: true,
  imports: [FormsModule, CommonModule, MenuComponent],
  templateUrl: './register-vehicle.component.html',
  styleUrls: ['./register-vehicle.component.css'],
})
export class RegisterVehicleComponent implements OnInit {
  marca: string = '';
  modelo: string = '';
  anyo: string = '';
  matricula: string = '';
  mensajeError: string = '';
  mensajeExito: string = '';
  vehiculos: any[] = []; // Array para almacenar los vehículos del usuario
  vehiculoEnEdicion: any = null;

  constructor(private dataAccessService: DataAccessService) {}

  /**
   * Inicializa el componente y carga los vehículos del usuario al inicio
   */
  ngOnInit(): void {
    this.obtenerVehiculos(); // Llamada a la API para obtener los vehículos al iniciar el componente
  }

  /**
   * Crea un nuevo vehículo con los datos del formulario
   * Realiza validaciones de matrícula y año antes de enviar la petición
   * Actualiza los mensajes de éxito o error según el resultado
   */
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
      matricula: this.matricula,
    };

    this.dataAccessService.crearVehiculo(vehiculo).subscribe(
      (response) => {
        if (response.success) {
          this.mensajeExito = 'Vehículo registrado con éxito';
          this.mensajeError = ''; // Limpiar mensaje de error
          this.obtenerVehiculos(); // Recargar la lista de vehículos
        } else {
          this.mensajeExito = ''; // Limpiar mensaje de éxito
          this.mensajeError =
            'Error al registrar el vehículo: ' + response.message;
        }
      },
      (error) => {
        this.mensajeExito = ''; // Limpiar mensaje de éxito
        this.mensajeError = 'Hubo un error en la comunicación con el servidor';
        console.error('Error al registrar el vehículo:', error);
      }
    );
  }

  /**
   * Obtiene la lista de vehículos del usuario desde el servidor
   * Actualiza la propiedad vehiculos con la respuesta
   * Maneja los errores mostrando mensajes apropiados
   */
  obtenerVehiculos() {
    this.dataAccessService.obtenerVehiculos().subscribe(
      (response) => {
        if (response) {
          console.log('Vehículos obtenidos:', response);
          this.vehiculos = response.vehicles; // Asignamos los vehículos a la propiedad vehiculos
        } else {
          this.mensajeError = 'No se pudieron cargar los vehículos.';
        }
      },
      (error) => {
        this.mensajeError = 'Hubo un error al obtener los vehículos';
        console.error('Error al obtener los vehículos:', error);
      }
    );
  }

  /**
   * Elimina un vehículo específico del sistema
   * Solicita confirmación antes de proceder con la eliminación
   * @param id - Identificador único del vehículo a eliminar
   */
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
            this.mensajeError =
              'No se pudo eliminar el vehículo: ' + response.message;
            this.mensajeExito = '';
          }
        },
        error: (error) => {
          console.error('Error al eliminar el vehículo:', error);
          this.mensajeError = 'Error al eliminar el vehículo';
          this.mensajeExito = '';
        },
      });
    }
  }

  /**
   * Prepara el formulario para editar un vehículo
   */
  editarVehiculo(vehiculo: any) {
    this.vehiculoEnEdicion = vehiculo;
    this.marca = vehiculo.marca;
    this.modelo = vehiculo.modelo;
    this.anyo = vehiculo.anyo;
    this.matricula = vehiculo.matricula;
  }

  /**
   * Guarda los cambios del vehículo en edición
   */
  guardarCambios() {
    if (!this.vehiculoEnEdicion) return;

    const vehiculo = {
      marca: this.marca,
      modelo: this.modelo,
      anyo: this.anyo,
      matricula: this.matricula,
    };

    this.dataAccessService
      .editarVehiculo(this.vehiculoEnEdicion.VehicleID, vehiculo)
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.mensajeExito = 'Vehículo actualizado correctamente';
            this.mensajeError = '';
            this.obtenerVehiculos();
            this.cancelarEdicion();
          } else {
            this.mensajeError =
              'Error al actualizar el vehículo: ' + response.message;
            this.mensajeExito = '';
          }
        },
        error: (error) => {
          console.error('Error al actualizar el vehículo:', error);
          this.mensajeError = 'Error al actualizar el vehículo';
          this.mensajeExito = '';
        },
      });
  }

  /**
   * Cancela la edición y limpia el formulario
   */
  cancelarEdicion() {
    this.vehiculoEnEdicion = null;
    this.marca = '';
    this.modelo = '';
    this.anyo = '';
    this.matricula = '';
  }
}
