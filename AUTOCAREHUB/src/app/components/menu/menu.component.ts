import { Component, OnInit } from '@angular/core';
import { USER_MENU_ROUTES } from './user-menu-routes';
import { WORKSHOP_MENU_ROUTES } from './workshop-menu-routes';
import { ADMIN_MENU_ROUTES } from './admin-menu-routes';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { I18nService } from '../../services/i18n.service';

@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.css'],
  standalone: true,
  imports: [RouterLink, CommonModule],
})
export class MenuComponent implements OnInit {
  menuRoutes: { path: string; label: string }[] = [];

  constructor(public i18n: I18nService) {}

  ngOnInit(): void {
    const currentUser = localStorage.getItem('currentUser');

    if (currentUser) {
      const user = JSON.parse(currentUser);
      const role = user.role.toLowerCase(); // "usuario", "taller" o "administrador"

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
}
