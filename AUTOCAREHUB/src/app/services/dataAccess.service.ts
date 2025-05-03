import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

interface LoginResponse {
  success: boolean;
  message?: string;
  user?: {
    name: string;
    email: string;
    role: string;  // Añadir campo de rol para verificar si es Taller o Usuario
  };
}

interface RegisterResponse {
  success: boolean;
  message?: string;
  errors?: string[];
  user?: {id: number;
    name: string;
    email: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class DataAccessService {
  private apiUrl = 'http://localhost/PHP';
  private httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json'
    })
  };

  constructor(private http: HttpClient) {}

  // Método para comprobar la cuenta de usuario (Login)
  checkUserAccount(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(
      `${this.apiUrl}/login.php`,
      { email, password },
      {
        headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
        withCredentials: true
      }
    ).pipe(
      map(response => {
        if (response.success) {
          localStorage.setItem('currentUser', JSON.stringify(response.user));
        }
        return response;
      }),
      catchError(error => {
        console.error('Error en login:', error);
        throw error;
      })
    );
  }

  // Método para registrar un nuevo usuario
  registerUser(
    email: string,
    fullName: string,
    password: string,
    notificationType: string,
    contactValue: string
  ): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(
      `${this.apiUrl}/register.php`,
      { email, fullName, password, notificationType, contactValue },
      this.httpOptions
    ).pipe(
      map(response => {
        if (response.success) {
          localStorage.setItem('currentUser', JSON.stringify(response.user));
        }
        return response;
      }),
      catchError(error => {
        console.error('Error en registro:', error);
        throw error;
      })
    );
  }

  // Método para consultar las facturas de un taller o usuario
  obtenerFacturas(): Observable<any> {
    const currentUser = this.getCurrentUser();
    if (!currentUser) {
      return throwError(() => new Error('Usuario no autenticado'));
    }

    const userRole = currentUser.role; // Obtenemos el rol del usuario

    if (userRole === 'Taller') {
      // Si es Taller, obtener todas las facturas del taller
      const body = { accion: 'ver_facturas_taller', WorkshopID: currentUser.id }; // Suponiendo que el ID de taller es el ID del usuario
      return this.http.post<any>(`${this.apiUrl}/facturas.php`, body, this.httpOptions).pipe(
        map(response => response),
        catchError(error => {
          console.error('Error al obtener las facturas del taller:', error);
          return throwError(() => new Error('Error al obtener las facturas'));
        })
      );
    } else {
      // Si es un usuario estándar, obtener las facturas asociadas a sus citas
      const body = { accion: 'ver_facturas_usuario', UserID: currentUser.id };
      return this.http.post<any>(`${this.apiUrl}/facturas.php`, body, this.httpOptions).pipe(
        map(response => response),
        catchError(error => {
          console.error('Error al obtener las facturas del usuario:', error);
          return throwError(() => new Error('Error al obtener las facturas'));
        })
      );
    }
  }

  // Método para crear una nueva factura
  crearFactura(appointmentId: number, items: any[], estado: string = 'Pendiente'): Observable<any> {
    const currentUser = this.getCurrentUser();
    if (!currentUser) {
      return throwError(() => new Error('Usuario no autenticado'));
    }

    const body = {
      appointment_id: appointmentId,
      estado: estado,
      items: items
    };

    return this.http.post<any>(`${this.apiUrl}/facturas.php`, body, this.httpOptions).pipe(
      map(response => response),
      catchError(error => {
        console.error('Error al crear la factura:', error);
        return throwError(() => new Error('Error al crear la factura'));
      })
    );
  }

  // Método para consultar la semana y los horarios de un taller
  consultarSemana(workshopID: number, fechaInicio: string, fechaFin: string): Observable<any> {
    const body = {
      accion: 'consultar_semana',
      WorkshopID: workshopID,
      FechaInicio: fechaInicio,
      FechaFin: fechaFin
    };

    return this.http.post<any>(`${this.apiUrl}/Create_Appointment.php`, body, {
      ...this.httpOptions,
      withCredentials: true
    }).pipe(
      map(response => response),
      catchError(error => {
        console.error('Error al consultar huecos de la semana:', error);
        throw error;
      })
    );
  }

  // Método para crear una cita
  crearCita(cita: {
    Fecha: string,
    HoraInicio: string,
    VehicleID: number,
    WorkshopID: number,
    Motivo: string
  }): Observable<any> {
    const body = {
      accion: 'crear',
      Fecha: cita.Fecha,
      Hora: cita.HoraInicio,
      VehicleID: cita.VehicleID,
      WorkshopID: cita.WorkshopID,
      Descripcion: cita.Motivo,
      Estado: 'Pendiente'
    };

    console.log('Enviando datos de cita:', body);

    return this.http.post<any>(`${this.apiUrl}/Create_Appointment.php`, body, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
      withCredentials: true
    }).pipe(
      map(response => {
        console.log('Respuesta del servidor:', response);
        if (!response.success) {
          console.warn('No se pudo crear la cita:', response.message);
        }
        return response;
      }),
      catchError(error => {
        console.error('Error al crear la cita:', error);
        throw error;
      })
    );
  }

  // Método para crear un nuevo vehículo
  crearVehiculo(vehiculo: {
    marca: string,
    modelo: string,
    anyo: string,
    matricula: string
  }): Observable<any> {
    const body = {
      accion: 'crear', 
      marca: vehiculo.marca,
      modelo: vehiculo.modelo,
      anyo: vehiculo.anyo,
      matricula: vehiculo.matricula
    };

    return this.http.post<any>(`${this.apiUrl}/Vehicles.php`, body, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
      withCredentials: true
    }).pipe(
      map(response => {
        if (!response.success) {
          console.warn('No se pudo crear el vehículo:', response.message);
        }
        return response;
      }),
      catchError(error => {
        console.error('Error al crear el vehículo:', error);
        throw error;
      })
    );
  }

  // Método para obtener todos los vehículos
  obtenerVehiculos(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/Vehicles.php`, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
      withCredentials: true
    }).pipe(
      map(response => response),
      catchError(error => {
        console.error('Error al obtener los vehículos:', error);
        return throwError(() => new Error('Error al obtener los vehículos'));
      })
    );
  }

  // Método para obtener las citas de un taller
  obtenerCitasTaller(): Observable<any> {
    const body = {
      accion: 'ver_citas_taller', 
      WorkshopID: 1  // Cambia esto al ID del taller que necesites
    };

    return this.http.post<any>(`${this.apiUrl}/Create_Appointment.php`, body, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
      withCredentials: true
    }).pipe(
      map(response => response),
      catchError(error => {
        console.error('Error al obtener las citas del taller:', error);
        return throwError(() => new Error('Error en la petición al servidor'));
      })
    );
  }

  // Método para obtener el usuario actual desde el localStorage
  getCurrentUser(): any {
    const user = localStorage.getItem('currentUser');
    return user ? JSON.parse(user) : null;
  }
}
