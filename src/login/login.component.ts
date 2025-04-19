import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { LanguageConfigurator } from '../app/language-configurator.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
})
export class LoginComponent {
  email = '';
  password = '';
  selectedLang!: 'es' | 'en';

  constructor(public langConfig: LanguageConfigurator) {
    this.selectedLang== this.langConfig.getLanguage()
  }

  onLogin() {
    // Cambiar el idioma al hacer login
    this.langConfig.setLanguage(this.selectedLang);
    console.log('Idioma seleccionado:', this.selectedLang);
    console.log('Email:', this.email);
    console.log('Password:', this.password);

    // Aquí iría tu lógica real de login
  }

  // Método para cambiar el idioma dinámicamente
  onLanguageChange() {
    this.langConfig.setLanguage(this.selectedLang);
  }
}
