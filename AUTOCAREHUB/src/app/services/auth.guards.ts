import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

/**
 * Guards de ruta de AutoCareHub.
 *
 * Seguridad de navegación en el frontend: impiden abrir pantallas por URL sin
 * estar autenticado y restringen el acceso según el rol del usuario.
 *
 * Nota: la autorización real de los datos la sigue haciendo el backend (sesión
 * PHP). Estos guards protegen la UI; manipular el localStorage solo afecta a la
 * navegación, no da acceso a datos del servidor.
 */

/** Lee el usuario actual del localStorage de forma segura. */
function getCurrentUser(): any | null {
  try {
    const raw = localStorage.getItem('currentUser');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Exige que haya un usuario autenticado; si no, redirige a /login. */
export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  return getCurrentUser() ? true : router.createUrlTree(['/login']);
};

/**
 * Restringe una ruta a los roles indicados.
 * - Sin sesión → /login.
 * - Rol no permitido → /home (su propia zona).
 */
export const roleGuard = (rolesPermitidos: string[]): CanActivateFn => {
  return () => {
    const router = inject(Router);
    const user = getCurrentUser();
    if (!user) {
      return router.createUrlTree(['/login']);
    }
    const rol = String(user.role ?? '').toLowerCase();
    const permitidos = rolesPermitidos.map((r) => r.toLowerCase());
    return permitidos.includes(rol) ? true : router.createUrlTree(['/home']);
  };
};
