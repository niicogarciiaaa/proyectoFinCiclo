import { ErrorHandler, Injectable } from '@angular/core';

/**
 * Tras un despliegue, una pestaña abierta con la versión anterior puede pedir
 * trozos de código (chunk-XXXX.js) que ya no existen en el servidor. En ese
 * caso se recarga la página una sola vez para traer la versión nueva, en vez
 * de dejar la pantalla en blanco.
 */
@Injectable()
export class ChunkErrorHandler implements ErrorHandler {
  private readonly CLAVE = 'autocare.recargaPorVersion';
  private readonly PATRON = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError/i;

  handleError(error: unknown): void {
    const mensaje = String((error as any)?.message ?? error ?? '');
    if (this.PATRON.test(mensaje) && this.puedeRecargar()) {
      location.reload();
      return;
    }
    console.error(error);
  }

  /** Evita bucles: como mucho una recarga automática cada 30 segundos. */
  private puedeRecargar(): boolean {
    try {
      const ultima = Number(sessionStorage.getItem(this.CLAVE) || 0);
      if (Date.now() - ultima < 30_000) return false;
      sessionStorage.setItem(this.CLAVE, String(Date.now()));
      return true;
    } catch {
      return false;
    }
  }
}
