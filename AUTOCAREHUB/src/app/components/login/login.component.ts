import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { DataAccessService } from '../../services/dataAccess.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  loginForm: FormGroup;
  errorMessage: string = '';
  loading: boolean = false;

  constructor(
    private fb: FormBuilder, 
    private dataAccessService: DataAccessService, 
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
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
            // Guardar información del usuario si es necesario
            localStorage.setItem('userName', response.user?.name || '');
            
            // Redirigir según el rol del usuario
            if (response.success ) {
              this.router.navigate(['/home']);
            }
          } else {
            this.errorMessage = response.message || 'Error al iniciar sesión';
          }
        },
        error: (error) => {
          if (error.status === 429) {
            this.errorMessage = 'Demasiados intentos. Por favor, espere 30 minutos.';
          } else {
            this.errorMessage = error.error?.message || 'Error al conectar con el servidor';
          }
        },
        complete: () => {
          this.loading = false;
        }
      });
    } else {
      this.errorMessage = 'Por favor, complete todos los campos correctamente';
    }
  }
}