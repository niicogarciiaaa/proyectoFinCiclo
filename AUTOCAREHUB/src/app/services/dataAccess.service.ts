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
      this.httpOptions
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
  registerUser(email: string, fullName: string, password: string): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(
      `${this.apiUrl}/register.php`,
      { email, fullName, password },
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
  

  logout(): void {
    // Limpia la información del usuario al cerrar sesión
    localStorage.removeItem('currentUser');
  }

  getCurrentUser(): any {
    const user = localStorage.getItem('currentUser');
    return user ? JSON.parse(user) : null;
  }
}