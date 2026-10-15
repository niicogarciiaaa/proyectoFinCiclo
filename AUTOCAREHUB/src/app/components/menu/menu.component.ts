import { Component, OnInit } from '@angular/core';
import { USER_MENU_ROUTES } from './user-menu-routes';
import { WORKSHOP_MENU_ROUTES } from './workshop-menu-routes';
import { ADMIN_MENU_ROUTES } from './admin-menu-routes';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { I18nService } from '../../services/i18n.service';
import { ThemeService } from '../../services/theme.service';
import { DataAccessService } from '../../services/dataAccess.service';

@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.css'],
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule],
})
export class MenuComponent implements OnInit {
  menuRoutes: { path: string; label: string }[] = [];
  userName = '';
  menuAbierto = false;

  constructor(
    public i18n: I18nService,
    public theme: ThemeService,
    private dataAccess: DataAccessService,
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
    }
  }

  /** Cierra la sesión en el servidor y vuelve al login. */
  cerrarSesion(): void {
    this.dataAccess.cerrarSesion().subscribe({
      complete: () => this.router.navigate(['/login']),
      error: () => this.router.navigate(['/login']),
    });
  }
}
