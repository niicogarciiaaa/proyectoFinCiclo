import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

interface LoginResponse {
  success: boolean;
  message?: string;
  user?: {
    id: number;
    name: string;
    email: string;
    role: string;  // Añadir campo de rol para verificar si es Taller o Usuario
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

export interface InvoiceItem {
  ItemID: number;
  Description: string;
  Quantity: number;
  UnitPrice: number;
  TaxRate: number;
  Amount: number;
}

export interface Invoice {
  InvoiceID: number;
  AppointmentID: number;
  Date: string;
  TotalAmount: number;
  Estado: string;
  UserName?: string; // Solo disponible para modo taller
  Marca?: string;
  Modelo?: string;
  Anyo: string;
  items: InvoiceItem[];
  WorkshopName?: string; // Solo disponible para modo usuario
  WorkshopAddress?: string; // Solo disponible para modo usuario
  WorkshopPhone?: string; // Solo disponible para modo usuario
}

export interface InvoiceStats {
  total_facturas: number;
  total_facturado: number;
  promedio_factura: number;
  pendientes: number;
  pagadas: number;
}

// Añadir después de las interfaces existentes pero antes de la clase DataAccessService
export interface InvoiceSearchParams {
  startDate?: string;
  endDate?: string;
  estado?: 'Pendiente' | 'Pagada' | null;
}

export interface InvoiceResponse {
  invoices: Invoice[];
}

export interface Chat {
  ChatID: number;
  UserID: number;
  WorkshopID: number;
  LastMessage: string;
  Status: 'Active' | 'Archived';
  CreateAt: string;
  WorkshopName?: string;
  UserName?: string;
  unreadCount: number;
}

export interface Message {
  MessageID: number;
  ChatID: number;
  SenderID: number;
  Message: string;
  IsRead: boolean;
  CreateAt: string;
  SenderName: string;
}

export interface Workshop {
  WorkshopID?: number;
  UserID?: number;
  Name: string;
  Address: string;
  Phone: string;
  Description?: string;
  Email?: string;
  FullName?: string;
}

@Injectable({
  providedIn: 'root'
})
export class DataAccessService {
  private apiUrl = environment.apiUrl; // Usar configuración de entorno
  private httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json'
    }),
    withCredentials: true // Crucial para mantener la sesión PHP
  };

  constructor(private http: HttpClient) {}

  /**
   * Autentica al usuario mediante sus credenciales
   * @param email - Correo electrónico del usuario
   * @param password - Contraseña del usuario
   * @returns Observable con la respuesta del login
   */
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

  /**
   * Registra un nuevo usuario en el sistema
   * @param email - Correo electrónico del nuevo usuario
   * @param fullName - Nombre completo
   * @param password - Contraseña
   * @param notificationType - Tipo de notificación preferida
   * @param contactValue - Valor de contacto según el tipo de notificación
   * @returns Observable con la respuesta del registro
   */
  registerUser(email: string, fullName: string, password: string,
    notificationType: string, contactValue: string): Observable<RegisterResponse> {
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

  /**
   * Obtiene las facturas del usuario o taller actual
   * @returns Observable con la lista de facturas
   */
  obtenerFacturas(): Observable<InvoiceResponse> {
    const currentUser = this.getCurrentUser();
    if (!currentUser) {
      return throwError(() => new Error('Usuario no autenticado'));
    }

    return this.http.get<InvoiceResponse>(`${this.apiUrl}/Invoices.php`, this.httpOptions).pipe(
      map(response => response),
      catchError(error => {
        console.error('Error al obtener las facturas:', error);
        if (error.status === 401) {
          return throwError(() => new Error('Sesión expirada o no válida. Por favor, inicia sesión nuevamente.'));
        }
        return throwError(() => new Error('Error al obtener las facturas'));
      })
    );
  }

  /**
   * Crea una nueva factura
   * @param appointmentId - ID de la cita asociada
   * @param items - Array de items de la factura
   * @param estado - Estado de la factura (por defecto 'Pendiente')
   * @returns Observable con la respuesta de la creación
   */
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

    return this.http.post<any>(`${this.apiUrl}/Invoices.php`, body, this.httpOptions).pipe(
      map(response => response),
      catchError(error => {
        console.error('Error al crear la factura:', error);
        return throwError(() => new Error('Error al crear la factura'));
      })
    );
  }

  /**
   * Consulta los horarios disponibles de un taller
   * @param workshopID - ID del taller
   * @param fechaInicio - Fecha de inicio de la consulta
   * @param fechaFin - Fecha fin de la consulta
   * @returns Observable con los horarios disponibles
   */
  consultarSemana(workshopID: number, fechaInicio: string, fechaFin: string): Observable<any> {
    const body = {
      accion: 'consultar_semana',
      WorkshopID: workshopID,
      FechaInicio: fechaInicio,
      FechaFin: fechaFin
    };

    return this.http.post<any>(`${this.apiUrl}/appointments.php`, body, {
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

  /**
   * Crea una nueva cita en el sistema
   * @param cita - Objeto con los datos de la cita
   * @returns Observable con la respuesta de la creación
   */
  crearCita(cita: { Fecha: string, HoraInicio: string, VehicleID: number,
    WorkshopID: number, Motivo: string, ServiceID?: number | null }): Observable<any> {
    // Llamada NUEVA de la Agenda Inteligente (no usa el 'crear' original).
    const body = {
      accion: 'crear_cita',
      Fecha: cita.Fecha,
      Hora: cita.HoraInicio,
      VehicleID: cita.VehicleID,
      WorkshopID: cita.WorkshopID,
      ServiceID: cita.ServiceID ?? null,
      Descripcion: cita.Motivo,
      Estado: 'Pendiente'
    };

    console.log('Enviando datos de cita:', body);

    return this.http.post<any>(`${this.apiUrl}/schedule.php`, body, {
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

  /**
   * Crea un nuevo vehículo para el usuario actual
   * @param vehiculo - Objeto con los datos del vehículo
   * @returns Observable con la respuesta de la creación
   */
  crearVehiculo(vehiculo: { marca: string, modelo: string, anyo: string,
    matricula: string }): Observable<any> {
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

  /**
   * Obtiene todos los vehículos del usuario actual
   * @returns Observable con la lista de vehículos
   */
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

  /**
   * Elimina un vehículo específico
   * @param id - ID del vehículo a eliminar
   * @returns Observable con la respuesta de la eliminación
   */
  eliminarVehiculo(id: number): Observable<any> {
    const body = {
      accion: 'eliminar',
      vehiculoID: id
    };
    return this.http.post<{ success: boolean; message: string }>(
      `${this.apiUrl}/Vehicles.php`, // Añadimos la ruta correcta
      body,
      {
        headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
        withCredentials: true
      }
    );
  }

  /**
   * Actualiza un vehículo existente
   * @param id - ID del vehículo a actualizar
   * @param vehiculo - Datos actualizados del vehículo
   */
  editarVehiculo(id: number, vehiculo: { marca: string, modelo: string, anyo: string, matricula: string }): Observable<any> {
    const body = {
      accion: 'editar',
      vehiculoID: id,
      marca: vehiculo.marca,
      modelo: vehiculo.modelo,
      anyo: vehiculo.anyo,
      matricula: vehiculo.matricula
    };

    return this.http.post<any>(`${this.apiUrl}/Vehicles.php`, body, {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
      withCredentials: true
    });
  }

  /**
   * Obtiene todas las citas asociadas al taller actual
   * @returns Observable con la lista de citas
   */
  obtenerCitasTaller(): Observable<any> {
    const currentUser = this.getCurrentUser();
    if (!currentUser || currentUser.role !== 'Taller') {
        return throwError(() => new Error('No autorizado'));
    }

    const body = {
        accion: 'ver_citas_taller'
    };

    // Corregida la ruta eliminando la duplicación de 'routes'
    return this.http.post<any>(`${this.apiUrl}/appointments.php`, body, {
        withCredentials: true,
        headers: new HttpHeaders({
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        })
    });
  }

  /**
   * Obtiene estadísticas de facturación por período
   * @param startDate - Fecha inicial del período
   * @param endDate - Fecha final del período
   * @returns Observable con las estadísticas de facturación
   */
  obtenerEstadisticasFacturacion(startDate: string, endDate: string): Observable<InvoiceStats> {
    return this.http.get<{stats: InvoiceStats}>(
      `${this.apiUrl}/Invoices.php?action=estadisticas&start_date=${startDate}&end_date=${endDate}`,
      this.httpOptions
    ).pipe(
      map(response => response.stats),
      catchError(error => {
        console.error('Error al obtener estadísticas:', error);
        return throwError(() => new Error('Error al obtener estadísticas de facturación'));
      })
    );
  }

  /**
   * Busca facturas por período y estado
   * @param params - Parámetros de búsqueda (fechas y estado)
   * @returns Observable con las facturas encontradas
   */
  buscarFacturas(params: InvoiceSearchParams): Observable<InvoiceResponse> {
    let queryParams = new URLSearchParams();
    queryParams.append('action', 'buscar');

    if (params.startDate) queryParams.append('start_date', params.startDate);
    if (params.endDate) queryParams.append('end_date', params.endDate);
    if (params.estado) queryParams.append('estado', params.estado);

    return this.http.get<InvoiceResponse>(
      `${this.apiUrl}/Invoices.php?${queryParams.toString()}`,
      this.httpOptions
    ).pipe(
      catchError(error => {
        console.error('Error en búsqueda de facturas:', error);
        return throwError(() => new Error('Error al buscar facturas'));
      })
    );
  }

  /**
   * Obtiene el resumen de facturación del mes actual
   * @returns Observable con las estadísticas del mes en curso
   */
  obtenerResumenMesActual(): Observable<InvoiceStats> {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
      .toISOString().split('T')[0];
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      .toISOString().split('T')[0];

    return this.obtenerEstadisticasFacturacion(firstDay, lastDay);
  }

  /**
   * Obtiene la lista de talleres disponibles
   */
  obtenerTalleres(): Observable<any> {
    return this.http.get(`${this.apiUrl}/workshops.php`, this.httpOptions).pipe(
      catchError(error => {
        console.error('Error al obtener talleres:', error);
        return throwError(() => new Error('Error al obtener la lista de talleres'));
      })
    );
  }

  // ============================================================
  //  AGENDA INTELIGENTE
  // ============================================================

  /**
   * (Taller) Obtiene el horario semanal y el catálogo de servicios del
   * taller del usuario autenticado.
   */
  obtenerConfigAgenda(): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/schedule.php`,
      { accion: 'obtener_config' }, this.httpOptions
    ).pipe(
      catchError(error => {
        console.error('Error al obtener la configuración de la agenda:', error);
        return throwError(() => new Error('Error al obtener la configuración de la agenda'));
      })
    );
  }

  /**
   * (Taller) Guarda el horario semanal completo.
   * @param schedule - array de 7 días con sus horas, descanso, capacidad y rejilla
   */
  guardarConfigAgenda(schedule: any[]): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/schedule.php`,
      { accion: 'guardar_config', schedule }, this.httpOptions
    ).pipe(
      catchError(error => {
        console.error('Error al guardar la configuración de la agenda:', error);
        return throwError(() => new Error('Error al guardar la configuración de la agenda'));
      })
    );
  }

  /** (Taller) Crea un servicio del catálogo. */
  crearServicio(servicio: { Name: string, DurationMinutes: number,
    Price?: number | null, IsActive?: boolean }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/schedule.php`,
      { accion: 'crear_servicio', ...servicio }, this.httpOptions
    ).pipe(
      catchError(error => {
        console.error('Error al crear el servicio:', error);
        return throwError(() => new Error('Error al crear el servicio'));
      })
    );
  }

  /** (Taller) Actualiza un servicio existente. */
  actualizarServicio(servicio: { ServiceID: number, Name: string,
    DurationMinutes: number, Price?: number | null, IsActive?: boolean }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/schedule.php`,
      { accion: 'actualizar_servicio', ...servicio }, this.httpOptions
    ).pipe(
      catchError(error => {
        console.error('Error al actualizar el servicio:', error);
        return throwError(() => new Error('Error al actualizar el servicio'));
      })
    );
  }

  /** (Taller) Elimina un servicio del catálogo. */
  eliminarServicio(serviceId: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/schedule.php`,
      { accion: 'eliminar_servicio', ServiceID: serviceId }, this.httpOptions
    ).pipe(
      catchError(error => {
        console.error('Error al eliminar el servicio:', error);
        return throwError(() => new Error('Error al eliminar el servicio'));
      })
    );
  }

  /** (Usuario) Lista los servicios activos de un taller concreto. */
  listarServicios(workshopId: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/schedule.php`,
      { accion: 'listar_servicios', WorkshopID: workshopId }, this.httpOptions
    ).pipe(
      catchError(error => {
        console.error('Error al listar los servicios:', error);
        return throwError(() => new Error('Error al listar los servicios'));
      })
    );
  }

  /** (Taller) Cambia el estado de una cita de su taller. */
  cambiarEstadoCita(appointmentId: number, status: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/schedule.php`,
      { accion: 'cambiar_estado', AppointmentID: appointmentId, Status: status }, this.httpOptions
    ).pipe(
      catchError(error => {
        console.error('Error al cambiar el estado de la cita:', error);
        return throwError(() => new Error('Error al cambiar el estado de la cita'));
      })
    );
  }

  /** (Usuario) Obtiene las citas del cliente autenticado. */
  obtenerMisCitas(): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/schedule.php`,
      { accion: 'mis_citas' }, this.httpOptions
    ).pipe(
      catchError(error => {
        console.error('Error al obtener mis citas:', error);
        return throwError(() => new Error('Error al obtener mis citas'));
      })
    );
  }

  /** (Usuario) Cancela una cita propia. */
  cancelarCita(appointmentId: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/schedule.php`,
      { accion: 'cancelar', AppointmentID: appointmentId }, this.httpOptions
    ).pipe(
      catchError(error => {
        console.error('Error al cancelar la cita:', error);
        return throwError(() => new Error('Error al cancelar la cita'));
      })
    );
  }

  // ============================================================
  //  VERIFACTU (RD 1007/2023) — llamadas nuevas
  // ============================================================

  /** (Taller) Obtiene los datos fiscales del emisor (NIF, razón social). */
  obtenerEmisorVerifactu(): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/verifactu.php`,
      { accion: 'obtener_emisor' }, this.httpOptions
    ).pipe(catchError(e => { console.error(e); return throwError(() => e); }));
  }

  /** (Taller) Guarda los datos fiscales del emisor. */
  guardarEmisorVerifactu(NIF: string, RazonSocial: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/verifactu.php`,
      { accion: 'guardar_emisor', NIF, RazonSocial }, this.httpOptions
    ).pipe(catchError(e => { console.error(e); return throwError(() => e); }));
  }

  /** (Taller) Genera (o recupera) el registro VeriFactu de una factura. */
  generarVerifactu(invoiceId: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/verifactu.php`,
      { accion: 'generar', InvoiceID: invoiceId }, this.httpOptions
    ).pipe(catchError(e => { console.error(e); return throwError(() => e); }));
  }

  /** Obtiene el registro VeriFactu de una factura (para el PDF/QR). */
  obtenerVerifactu(invoiceId: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/verifactu.php`,
      { accion: 'obtener', InvoiceID: invoiceId }, this.httpOptions
    ).pipe(catchError(e => { console.error(e); return throwError(() => e); }));
  }

  /** (Taller) Verifica la integridad de la cadena de huellas. */
  verificarCadenaVerifactu(): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/verifactu.php`,
      { accion: 'verificar_cadena' }, this.httpOptions
    ).pipe(catchError(e => { console.error(e); return throwError(() => e); }));
  }

  /**
   * (Taller) Citas del taller incluyendo el servicio (llamada nueva de la
   * Agenda Inteligente, para el calendario y el generador de facturas).
   */
  obtenerCitasTallerAgenda(): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/schedule.php`,
      { accion: 'citas_taller' }, this.httpOptions
    ).pipe(
      catchError(error => {
        console.error('Error al obtener las citas del taller (agenda):', error);
        return throwError(() => new Error('Error al obtener las citas del taller'));
      })
    );
  }

  /**
   * (Usuario) Calcula la disponibilidad real de un taller para un servicio
   * (o duración) en un rango de fechas.
   */
  consultarDisponibilidad(params: { WorkshopID: number, ServiceID?: number | null,
    DurationMinutes?: number, FechaInicio?: string, FechaFin?: string }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/schedule.php`,
      { accion: 'disponibilidad', ...params }, this.httpOptions
    ).pipe(
      catchError(error => {
        console.error('Error al consultar la disponibilidad:', error);
        return throwError(() => new Error('Error al consultar la disponibilidad'));
      })
    );
  }

  /**
   * Obtiene los datos del usuario actualmente autenticado
   * @returns Objeto con los datos del usuario o null si no hay sesión
   */
  getCurrentUser(): any {
    const user = localStorage.getItem('currentUser');
    return user ? JSON.parse(user) : null;
  }

  /**
   * Obtiene todos los chats del usuario actual
   */
  obtenerChats(): Observable<{success: boolean, chats: Chat[]}> {
    return this.http.get<{success: boolean, chats: Chat[]}>(
      `${this.apiUrl}/chats.php`,
      this.httpOptions
    ).pipe(
      catchError(error => {
        console.error('Error al obtener chats:', error);
        
        // Manejo específico de errores CORS y de red
        if (error.status === 0) {
          console.error('Error de CORS o conectividad:', error);
          return throwError(() => new Error('Error de conexión al servidor. Verifique su conexión a internet.'));
        }
        
        if (error.status === 403) {
          console.error('Error 403 - Acceso prohibido:', error);
          return throwError(() => new Error('Acceso prohibido al servidor.'));
        }
        
        return throwError(() => new Error('Error al obtener los chats: ' + (error.message || 'Error desconocido')));
      })
    );
  }

  /**
   * Obtiene los mensajes de un chat específico
   */
  obtenerMensajes(chatId: number): Observable<{success: boolean, messages: Message[]}> {
    return this.http.get<{success: boolean, messages: Message[]}>(
      `${this.apiUrl}/chats.php?chat_id=${chatId}`,
      this.httpOptions
    ).pipe(
      catchError(error => {
        console.error('Error al obtener mensajes:', error);
        return throwError(() => new Error('Error al obtener los mensajes'));
      })
    );
  }

  /**
   * Envía un mensaje en un chat
   */
  enviarMensaje(chatId: number, message: string): Observable<{success: boolean, message: string}> {
    return this.http.post<{success: boolean, message: string}>(
      `${this.apiUrl}/chats.php`,
      {
        action: 'enviar_mensaje',
        chat_id: chatId,
        message: message
      },
      this.httpOptions
    ).pipe(
      catchError(error => {
        console.error('Error al enviar mensaje:', error);
        return throwError(() => new Error('Error al enviar el mensaje'));
      })
    );
  }

  /**
   * Inicia un nuevo chat con un taller
   */
  iniciarChat(workshopId: number): Observable<{success: boolean, message: string, chat_id: number}> {
    return this.http.post<{success: boolean, message: string, chat_id: number}>(
      `${this.apiUrl}/chats.php`,
      {
        action: 'iniciar_chat',
        workshop_id: workshopId
      },
      this.httpOptions
    ).pipe(
      catchError(error => {
        console.error('Error al iniciar chat:', error);
        return throwError(() => new Error('Error al iniciar el chat'));
      })
    );
  }

  /**
   * Obtiene el número total de mensajes no leídos
   */
  getUnreadCount(chats: Chat[]): number {
    return chats.reduce((total, chat) => total + (chat.unreadCount || 0), 0);
  }

  /**
   * Actualiza la información de un taller existente
   * @param workshop - Datos actualizados del taller
   * @returns Observable con la respuesta de la actualización
   */
  updateWorkshop(workshop: Workshop): Observable<any> {
    const currentUser = this.getCurrentUser();
    if (!currentUser || currentUser.role.toLowerCase() !== 'administrador') {
      return throwError(() => new Error('No autorizado'));
    }

    return this.http.put<any>(`${this.apiUrl}/admin_workshops.php`, workshop, this.httpOptions).pipe(
      map(response => response),
      catchError(error => {
        console.error('Error al actualizar taller:', error);
        return throwError(() => new Error('Error al actualizar el taller'));
      })
    );
  }

  /**
   * Crea un nuevo taller en el sistema
   * @param workshop - Datos del nuevo taller
   * @returns Observable con la respuesta de la creación
   */
  createWorkshop(workshop: Workshop): Observable<any> {
    const currentUser = this.getCurrentUser();
    if (!currentUser || currentUser.role.toLowerCase() !== 'administrador') {
      return throwError(() => new Error('No autorizado'));
    }

    return this.http.post<any>(`${this.apiUrl}/admin_workshops.php`, workshop, this.httpOptions).pipe(
      map(response => response),
      catchError(error => {
        console.error('Error al crear taller:', error);
        return throwError(() => new Error('Error al crear el taller'));
      })
    );
  }
}
