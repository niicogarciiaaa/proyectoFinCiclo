import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';


@Injectable({
  providedIn: 'root'
})
export class UsuarioService {
  private apiUrl = `${environment.apiBaseUrl}/api/Usuarios`; // Cambia esto si tu API tiene una ruta diferente

  constructor(private http: HttpClient) { }

  register(usuario: any): Observable<any> {
    return this.http.post<any>(this.apiUrl, usuario);
  }
}
