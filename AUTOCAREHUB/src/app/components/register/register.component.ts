import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DataAccessService } from '../../services/dataAccess.service';
import { CommonModule } from '@angular/common';

interface RegisterResponse {
  success: boolean;
  message?: string;
  errors?: string[];
  user?: {
    id: number;
    name: string;
    email: string;
  };
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css'
})
export class RegisterComponent implements OnInit {
  registerForm: FormGroup;
  loading = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private dataAccess: DataAccessService,
    private router: Router
  ) {
    this.registerForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      fullName: ['', [Validators.required, Validators.minLength(3)]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, {
      validators: this.passwordMatchValidator
    });
  }

  ngOnInit(): void {}

  passwordMatchValidator(group: FormGroup) {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { passwordMismatch: true };
  }

  onSubmit(): void {
    if (this.registerForm.valid) {
      this.loading = true;
      this.errorMessage = '';

      const { email, fullName, password } = this.registerForm.value;

      this.dataAccess.registerUser(email, fullName, password).subscribe({
        next: (response: RegisterResponse) => {
          if (response.success) {
            this.router.navigate(['/login']);
          } else {
            this.errorMessage = response.message || 'Error en el registro';
            if (response.errors?.length) {
              this.errorMessage = response.errors.join(', ');
            }
          }
        },
        error: (error) => {
          console.error('Error en el registro:', error);
          this.errorMessage = error.error?.message || 'Error de conexión';
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
      return 'Este campo es requerido';
    }
    
    if (control.hasError('email')) {
      return 'Por favor, introduce un email válido';
    }
    
    if (control.hasError('minlength')) {
      const minLength = control.errors?.['minlength'].requiredLength;
      return `Debe tener al menos ${minLength} caracteres`;
    }
    
    if (fieldName === 'confirmPassword' && this.registerForm.hasError('passwordMismatch')) {
      return 'Las contraseñas no coinciden';
    }
    
    return '';
  }
}