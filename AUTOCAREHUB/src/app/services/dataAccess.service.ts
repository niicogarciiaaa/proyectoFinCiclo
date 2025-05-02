import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

interface LoginResponse {
  success: boolean;
  message?: string;
  user?: {
    name: string;
    email: string;
  };
}

interface RegisterResponse {
  success: boolean;
  message?: string;
  errors?: string[];
  user?: {
    id: number;
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
  consultarSemana(
    workshopID: number,
    fechaInicio: string,
    fechaFin: string
  ): Observable<any> {
    const body = {
      accion: 'consultar_semana',
      WorkshopID: workshopID,
      FechaInicio: fechaInicio,
      FechaFin: fechaFin
    };
  
    return this.http.post<any>(
      `${this.apiUrl}/Create_Appointment.php`,
      body,
      {
        ...this.httpOptions,
        withCredentials: true
      }
    )
    .pipe(
      map(response => {
        if (response.success) {
          // Puedes procesar los resultados aquí
        }
        return response;
      }),
      catchError(error => {
        console.error('Error al consultar huecos de la semana:', error);
        throw error;
      })
    );
    
  }
  crearCita(cita: {
    Fecha: string,
    HoraInicio: string,
    VehiculoID: number,
    WorkshopID: number,
    Motivo: string
}): Observable<any> {
  const body = {
    accion: 'crear',  // Acción a realizar, se ajusta al valor esperado por el PHP
    Fecha: cita.Fecha,  // Fecha de la cita
    Hora: cita.HoraInicio,  // Hora de inicio de la cita (se usará solo HoraInicio en lugar de HoraInicio y HoraFin)
    VehicleID: cita.VehiculoID,  // ID del vehículo
    WorkshopID: cita.WorkshopID,  // ID del taller
    Descripcion: cita.Motivo,  // Descripción del motivo (se ajusta al nombre esperado)
    Estado: 'Pendiente'  // Estado de la cita (inicialmente se asigna "Pendiente")
  };

  return this.http.post<any>(
    `${this.apiUrl}/Create_Appointment.php`,
    body,
    {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
      withCredentials: true
    }
  ).pipe(
    map(response => {
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
crearVehiculo(vehiculo: {
  marca: string,
  modelo: string,
  anyo: string,
  matricula: string
}): Observable<any> {
  const body = {
    accion: 'crear',  // Acción a realizar, se ajusta al valor esperado por el PHP
    marca: vehiculo.marca,  // Marca del vehículo
    modelo: vehiculo.modelo,  // Modelo del vehículo
    anyo: vehiculo.anyo,  // Año del vehículo
    matricula: vehiculo.matricula  // Matrícula del vehículo
  };

  return this.http.post<any>(
    `${this.apiUrl}/Vehicles.php`,
    body,
    {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
      withCredentials: true  // Asegura que se envíen las cookies de la sesión
    }
  ).pipe(
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

  


  getCurrentUser(): any {
    const user = localStorage.getItem('currentUser');
    return user ? JSON.parse(user) : null;
  }
}