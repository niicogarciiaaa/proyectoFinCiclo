import { Component, OnInit } from '@angular/core';
import { DataAccessService } from '../../services/dataAccess.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-register-vehicle',
  standalone: true,
  imports: [FormsModule, CommonModule],
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
    this.dataAccessService.eliminarVehiculo(id).subscribe({
  next: (res) => {
    if (res.success) {
      console.log('Vehículo eliminado correctamente');
      // Refresca la lista si es necesario
    } else {
      alert('No se pudo eliminar el vehículo: ' + res.message);
    }
  },
  error: (err) => {
    console.error(err);
    alert('Error al eliminar el vehículo');
  }
});

}
}
