import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
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
  styleUrl: './register.component.css',
})
export class RegisterComponent {
  registerForm: FormGroup;
  loading = false;
  errorMessage = '';
  selectedLang: string;

  notificationTypes = [
    { value: 'SMS', label: 'SMS' },
    { value: 'Telegram', label: 'Telegram' },
    { value: 'WhatsApp', label: 'WhatsApp' },
  ];

  constructor(
    private fb: FormBuilder,
    private dataAccess: DataAccessService,
    private router: Router,
    public i18n: I18nService
  ) {
    this.selectedLang = this.i18n.currentLang || 'es';
    this.registerForm = this.fb.group(
      {
        email: ['', [Validators.required, Validators.email]],
        fullName: ['', [Validators.required, Validators.minLength(3)]],
        password: ['', [Validators.required, Validators.minLength(6)]],
        confirmPassword: ['', [Validators.required]],
        notificationType: ['', [Validators.required]],
        contactValue: ['', [Validators.required]],
      },
      {
        validators: this.passwordMatchValidator,
      }
    );
  }

  /**
   * Cambia el idioma de la aplicación
   * @param lang - Código del idioma a establecer ('es', 'en', etc.)
   */
  changeLang(lang: string) {
    this.i18n.setLang(lang);
    this.selectedLang = lang;
  }

  /**
   * Valida que las contraseñas coincidan
   * @param group - Grupo de formulario que contiene los campos de contraseña
   * @returns null si las contraseñas coinciden, o un objeto de error si no coinciden
   */
  passwordMatchValidator(group: FormGroup) {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { passwordMismatch: true };
  }

  /**
   * Maneja el envío del formulario de registro
   * Valida el formulario y envía los datos al servidor
   */
  onSubmit(): void {
    if (this.registerForm.valid) {
      this.loading = true;
      this.errorMessage = '';

      const { email, fullName, password, notificationType, contactValue } =
        this.registerForm.value;

      this.dataAccess
        .registerUser(email, fullName, password, notificationType, contactValue)
        .subscribe({
          next: (response: RegisterResponse) => {
            if (response.success) {
              this.router.navigate(['/login']);
            } else {
              this.errorMessage =
                response.message || this.i18n.t('errorRegistro');
              if (response.errors?.length) {
                this.errorMessage = response.errors.join(', ');
              }
            }
          },
          error: (error) => {
            console.error('Error en el registro:', error);
            this.errorMessage =
              error.error?.message || this.i18n.t('errorConexion');
            this.loading = false;
          },
          complete: () => {
            this.loading = false;
          },
        });
    } else {
      this.markFormGroupTouched(this.registerForm);
    }
  }

  /**
   * Marca todos los campos del formulario como tocados para mostrar errores
   * @param formGroup - Grupo de formulario cuyos campos se marcarán
   */
  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach((control) => {
      control.markAsTouched();
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  /**
   * Verifica si un campo específico del formulario es inválido
   * @param fieldName - Nombre del campo a verificar
   * @returns true si el campo es inválido y ha sido tocado
   */
  isFieldInvalid(fieldName: string): boolean {
    const field = this.registerForm.get(fieldName);
    return field ? !field.valid && field.touched : false;
  }

  /**
   * Obtiene el mensaje de error para un campo específico
   * @param fieldName - Nombre del campo del que se obtendrá el mensaje de error
   * @returns Mensaje de error correspondiente al tipo de error presente
   */
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

    if (
      fieldName === 'confirmPassword' &&
      this.registerForm.hasError('passwordMismatch')
    ) {
      return this.i18n.t('contrasenasNoCoinciden');
    }

    return '';
  }
}
