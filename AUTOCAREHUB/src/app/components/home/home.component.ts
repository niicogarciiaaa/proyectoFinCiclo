import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MenuComponent } from '../menu/menu.component';
import { I18nService } from '../../services/i18n.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [MenuComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  constructor(public i18n: I18nService) {}
}
