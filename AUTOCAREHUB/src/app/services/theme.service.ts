import { Injectable } from '@angular/core';

export type Tema = 'claro' | 'oscuro';

/**
 * Modo oscuro de AutoCareHub.
 *
 * Guarda la preferencia del usuario en localStorage y, si no hay ninguna,
 * respeta la preferencia del sistema operativo (prefers-color-scheme).
 * El tema se aplica con el atributo data-theme en <html>; los estilos
 * están en src/styles.css.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private static readonly CLAVE = 'autocarehub-tema';
  tema: Tema = 'claro';

  constructor() {
    this.tema = this.leerPreferencia();
    this.aplicar();
  }

  get esOscuro(): boolean {
    return this.tema === 'oscuro';
  }

  alternar(): void {
    this.tema = this.esOscuro ? 'claro' : 'oscuro';
    try {
      localStorage.setItem(ThemeService.CLAVE, this.tema);
    } catch {
      // Sin almacenamiento disponible: el tema solo dura esta visita.
    }
    this.aplicar();
  }

  private leerPreferencia(): Tema {
    try {
      const guardado = localStorage.getItem(ThemeService.CLAVE);
      if (guardado === 'claro' || guardado === 'oscuro') return guardado;
    } catch {
      // Ignorar: se usa la preferencia del sistema.
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
  }

  private aplicar(): void {
    document.documentElement.setAttribute('data-theme', this.tema === 'oscuro' ? 'dark' : 'light');
  }
}
