import { Component, OnInit } from '@angular/core';
import { USER_MENU_ROUTES } from './user-menu-routes';
import { WORKSHOP_MENU_ROUTES } from './workshop-menu-routes';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.css'],
  standalone: true,
  imports: [RouterLink,CommonModule]
})
export class MenuComponent implements OnInit {
  menuRoutes: { path: string, label: string }[] = [];

  ngOnInit(): void {
    const currentUser = localStorage.getItem('currentUser');

    if (currentUser) {
      const user = JSON.parse(currentUser);
      const role = user.role.toLowerCase(); // "usuario" o "taller"

      if (role === 'taller') {
        this.menuRoutes = WORKSHOP_MENU_ROUTES;
      } else {
        this.menuRoutes = USER_MENU_ROUTES;
      }
    }
  }
}
