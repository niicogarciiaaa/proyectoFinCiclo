import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { DataAccessService } from '../../services/dataAccess.service';
import { Router, RouterModule } from '@angular/router';
import { I18nService } from '../../services/i18n.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  loginForm: FormGroup;
  errorMessage: string = '';
  loading: boolean = false;
  selectedLang: string;

  constructor(
    private fb: FormBuilder,
    private dataAccessService: DataAccessService,
    private router: Router,
    public i18n: I18nService
  ) {
    this.selectedLang = this.i18n.currentLang || 'es';
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  changeLang(lang: string) {
    this.i18n.setLang(lang);
    this.selectedLang = lang;
  }

  checkAccount() {
    if (this.loginForm.valid) {
      this.loading = true;
      this.errorMessage = '';

      const email = this.loginForm.get('email')?.value;
      const password = this.loginForm.get('password')?.value;

      this.dataAccessService.checkUserAccount(email, password).subscribe({
        next: (response) => {
          if (response.success) {
            localStorage.setItem('userName', response.user?.name || '');
            if (response.success) {
              this.router.navigate(['/home']);
            }
          } else {
            this.errorMessage = response.message || this.i18n.t('errorIniciarSesion');
          }
        },
        error: (error) => {
          if (error.status === 429) {
            this.errorMessage = this.i18n.t('demasiadosIntentos');
          } else {
            this.errorMessage = error.error?.message || this.i18n.t('errorServidor');
          }
        },
        complete: () => {
          this.loading = false;
        }
      });
    } else {
      this.errorMessage = this.i18n.t('camposIncorrectos');
    }
  }
}