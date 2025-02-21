// app.component.ts
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { FooterComponent } from "./components/footer/footer.component";

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  standalone: true,
  imports: [RouterModule, FooterComponent]
})
export class AppComponent { }