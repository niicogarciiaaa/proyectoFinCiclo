import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { USER_MENU_ROUTES } from './user-menu-routes';
import { WORKSHOP_MENU_ROUTES } from './workshop-menu-routes';
import { ADMIN_MENU_ROUTES } from './admin-menu-routes';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { I18nService } from '../../services/i18n.service';
import { ThemeService } from '../../services/theme.service';
import { DataAccessService } from '../../services/dataAccess.service';
import { BadgesService, Contadores } from '../../services/badges.service';

@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.css'],
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule],
})
export class MenuComponent implements OnInit, OnDestroy {
  menuRoutes: { path: string; label: string }[] = [];
  userName = '';
  menuAbierto = false;

  /** Avisos por ruta (mensajes sin leer, citas por confirmar...). */
  contadores: Contadores = {};
  private subContadores: Subscription | null = null;

  /** Texto accesible de cada aviso, por ruta. */
  private readonly TEXTO_AVISO: { [ruta: string]: string } = {
    '/chat': 'menu.badgeChat',
    '/agendaSemanal': 'menu.badgeAgenda',
    '/misCitas': 'menu.badgeMisCitas',
    '/invoiceViewer': 'menu.badgeFacturas',
  };

  constructor(
    public i18n: I18nService,
    public theme: ThemeService,
    private dataAccess: DataAccessService,
    private badges: BadgesService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const currentUser = localStorage.getItem('currentUser');

    if (currentUser) {
      const user = JSON.parse(currentUser);
      const role = user.role.toLowerCase(); // "usuario", "taller" o "administrador"
      this.userName = user.name || '';

      switch (role) {
        case 'taller':
          this.menuRoutes = WORKSHOP_MENU_ROUTES;
          break;
        case 'administrador':
          this.menuRoutes = ADMIN_MENU_ROUTES;
          break;
        default:
          this.menuRoutes = USER_MENU_ROUTES;
      }

      this.subContadores = this.badges.contadores$.subscribe((c) => (this.contadores = c));
      this.badges.iniciar();
    }
  }

  ngOnDestroy(): void {
    this.subContadores?.unsubscribe();
  }

  /** Hay algún aviso (para el punto del botón del menú en móvil). */
  get hayAvisos(): boolean {
    return this.menuRoutes.some((r) => (this.contadores[r.path] || 0) > 0);
  }

  textoAviso(ruta: string): string {
    const clave = this.TEXTO_AVISO[ruta];
    return `${this.contadores[ruta]} ${clave ? this.i18n.t(clave) : ''}`.trim();
  }

  /** Cierra la sesión en el servidor y vuelve al login. */
  cerrarSesion(): void {
    this.badges.detener();
    this.dataAccess.cerrarSesion().subscribe({
      complete: () => this.router.navigate(['/login']),
      error: () => this.router.navigate(['/login']),
    });
  }
}
