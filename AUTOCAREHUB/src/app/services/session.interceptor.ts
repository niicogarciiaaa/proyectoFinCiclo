import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

/**
 * Si el backend responde 401 (la sesión PHP ha caducado o no existe),
 * se borran los datos locales del usuario y se vuelve al login, en lugar
 * de dejar la interfaz "logueada" pero sin poder cargar datos.
 */
export const sessionInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const esLogin = req.url.includes('/login.php');
      if (error.status === 401 && !esLogin && localStorage.getItem('currentUser')) {
        localStorage.removeItem('currentUser');
        localStorage.removeItem('userName');
        router.navigate(['/login'], { queryParams: { sesion: 'caducada' } });
      }
      return throwError(() => error);
    })
  );
};
