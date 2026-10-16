import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, forkJoin, of, Subscription, timer } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { DataAccessService } from './dataAccess.service';

/** Contadores por ruta del menú: { '/chat': 2, '/agendaSemanal': 1 }. */
export type Contadores = { [ruta: string]: number };

/**
 * Avisos del menú: cuenta lo que requiere atención (mensajes sin leer,
 * citas por confirmar, facturas pendientes...) usando las llamadas que ya
 * existen, y lo refresca cada minuto mientras la pestaña está visible.
 */
@Injectable({ providedIn: 'root' })
export class BadgesService implements OnDestroy {
  private readonly INTERVALO_MS = 60_000;

  private contadoresSubject = new BehaviorSubject<Contadores>({});
  readonly contadores$ = this.contadoresSubject.asObservable();

  private sondeo: Subscription | null = null;
  private rol = '';

  constructor(private dataAccess: DataAccessService) {}

  /** Empieza a vigilar los avisos (si ya estaba en marcha, solo refresca). */
  iniciar(): void {
    const rol = (this.dataAccess.getCurrentUser()?.role || '').toLowerCase();
    if (rol !== this.rol) {
      // Cambio de usuario: se descartan los contadores del anterior.
      this.detener();
      this.rol = rol;
    }
    if (this.sondeo) {
      this.refrescar();
      return;
    }
    this.sondeo = timer(0, this.INTERVALO_MS).subscribe(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        this.refrescar();
      }
    });
  }

  /** Para el sondeo y vacía los contadores (al cerrar sesión). */
  detener(): void {
    this.sondeo?.unsubscribe();
    this.sondeo = null;
    this.rol = '';
    this.contadoresSubject.next({});
  }

  /** Actualiza un contador sin esperar al siguiente sondeo (p. ej. al leer un chat). */
  fijar(ruta: string, valor: number): void {
    this.contadoresSubject.next({ ...this.contadoresSubject.value, [ruta]: valor });
  }

  /** Vuelve a calcular los contadores ahora mismo. */
  refrescar(): void {
    const chats$ = this.dataAccess.obtenerChats().pipe(
      map((res) => this.dataAccess.getUnreadCount(res?.chats || [])),
      catchError(() => of(0))
    );

    if (this.rol === 'taller') {
      const pendientes$ = this.dataAccess.obtenerCitasTallerAgenda().pipe(
        map((res) => {
          const ahora = new Date();
          return ((res && res.citas) || []).filter(
            (c: any) => c.Status === 'Pendiente' && this.fecha(c.StartDateTime) >= ahora
          ).length;
        }),
        catchError(() => of(0))
      );
      forkJoin([chats$, pendientes$]).subscribe(([chat, pendientes]) =>
        this.contadoresSubject.next({ '/chat': chat, '/agendaSemanal': pendientes })
      );
    } else if (this.rol === 'usuario') {
      const proximas$ = this.dataAccess.obtenerMisCitas().pipe(
        map((res) => {
          const ahora = Date.now();
          const limite = ahora + 48 * 3600 * 1000;
          return ((res && res.citas) || []).filter((c: any) => {
            const t = this.fecha(c.StartDateTime).getTime();
            return c.Status !== 'Cancelada' && t >= ahora && t <= limite;
          }).length;
        }),
        catchError(() => of(0))
      );
      const facturas$ = this.dataAccess.obtenerFacturas().pipe(
        map((res) => (res?.invoices || []).filter((f) => f.Estado === 'Pendiente').length),
        catchError(() => of(0))
      );
      forkJoin([chats$, proximas$, facturas$]).subscribe(([chat, proximas, facturas]) =>
        this.contadoresSubject.next({ '/chat': chat, '/misCitas': proximas, '/invoiceViewer': facturas })
      );
    }
  }

  ngOnDestroy(): void {
    this.sondeo?.unsubscribe();
  }

  /** 'YYYY-MM-DD HH:MM:SS' en hora local. */
  private fecha(dt: string): Date {
    return new Date((dt || '').replace(' ', 'T'));
  }
}
