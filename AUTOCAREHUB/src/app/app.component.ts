import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'AUTOCAREHUB';

  // Se inyecta aquí para aplicar el tema (claro/oscuro) nada más arrancar.
  constructor(_theme: ThemeService) {}
}
