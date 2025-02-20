import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  // NO debes tener "standalone: true" aquí.
  imports: [RouterOutlet]
})
export class AppComponent {
  title = 'AutoCare Hub';
}
