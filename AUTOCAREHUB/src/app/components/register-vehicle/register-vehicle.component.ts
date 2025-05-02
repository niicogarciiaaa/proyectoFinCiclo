import { Component } from '@angular/core';
import { DataAccessService } from '../../services/dataAccess.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-register-vehicle',
  standalone: true,
  imports: [FormsModule,CommonModule],
  templateUrl: './register-vehicle.component.html',
  styleUrls: ['./register-vehicle.component.css']
})
export class RegisterVehicleComponent {

  marca: string = '';
  modelo: string = '';
  anyo: string = '';
  matricula: string = '';
  mensajeError: string = '';
  mensajeExito: string = '';

  constructor(private dataAccessService: DataAccessService) { }

  // Método que se ejecuta al enviar el formulario
  crearVehiculo() {
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
          // Puedes hacer algo adicional aquí, como redirigir al usuario o limpiar el formulario
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
}
