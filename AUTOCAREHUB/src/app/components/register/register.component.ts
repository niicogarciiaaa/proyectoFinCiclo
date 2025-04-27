import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { DataAccessService } from '../../services/dataAccess.service';
import { CommonModule } from '@angular/common';
import { I18nService } from '../../services/i18n.service';
import { FormsModule } from '@angular/forms';

interface RegisterResponse {
  success: boolean;
  message?: string;
  errors?: string[];
  user?: {
    id: number;
    name: string;
    email: string;
    notificationType?: string;
    contactValue?: string;
  };
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterModule, FormsModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css'
})
export class RegisterComponent implements OnInit {
  registerForm: FormGroup;
  loading = false;
  errorMessage = '';
  selectedLang: string;

  notificationTypes = [
    { value: 'SMS', label: 'SMS' },
    { value: 'Telegram', label: 'Telegram' },
    { value: 'WhatsApp', label: 'WhatsApp' }
  ];

  constructor(
    private fb: FormBuilder,
    private dataAccess: DataAccessService,
    private router: Router,
    public i18n: I18nService
  ) {
    this.selectedLang = this.i18n.currentLang || 'es';
    this.registerForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      fullName: ['', [Validators.required, Validators.minLength(3)]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
      notificationType: ['', [Validators.required]],
      contactValue: ['', [Validators.required]]
    }, {
      validators: this.passwordMatchValidator
    });
  }

  ngOnInit(): void {}

  changeLang(lang: string) {
    this.i18n.setLang(lang);
    this.selectedLang = lang;
  }

  passwordMatchValidator(group: FormGroup) {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { passwordMismatch: true };
  }

  onSubmit(): void {
    if (this.registerForm.valid) {
      this.loading = true;
      this.errorMessage = '';

      const { email, fullName, password, notificationType, contactValue } = this.registerForm.value;

      this.dataAccess.registerUser(email, fullName, password, notificationType, contactValue).subscribe({
        next: (response: RegisterResponse) => {
          if (response.success) {
            this.router.navigate(['/login']);
          } else {
            this.errorMessage = response.message || this.i18n.t('errorRegistro');
            if (response.errors?.length) {
              this.errorMessage = response.errors.join(', ');
            }
          }
        },
        error: (error) => {
          console.error('Error en el registro:', error);
          this.errorMessage = error.error?.message || this.i18n.t('errorConexion');
          this.loading = false;
        },
        complete: () => {
          this.loading = false;
        }
      });
    } else {
      this.markFormGroupTouched(this.registerForm);
    }
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.registerForm.get(fieldName);
    return field ? !field.valid && field.touched : false;
  }

  getErrorMessage(fieldName: string): string {
    const control = this.registerForm.get(fieldName);

    if (!control) return '';

    if (control.hasError('required')) {
      return this.i18n.t('campoRequerido');
    }

    if (control.hasError('email')) {
      return this.i18n.t('emailValido');
    }

    if (control.hasError('minlength')) {
      const minLength = control.errors?.['minlength'].requiredLength;
      return this.i18n.t('minCaracteres', { min: minLength });
    }

    if (fieldName === 'confirmPassword' && this.registerForm.hasError('passwordMismatch')) {
      return this.i18n.t('contrasenasNoCoinciden');
    }

    return '';
  }
}