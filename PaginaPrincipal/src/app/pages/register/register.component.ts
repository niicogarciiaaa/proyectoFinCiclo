import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { FooterComponent } from "../../components/footer/footer.component";

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css'],
  imports: [FormsModule, CommonModule, ReactiveFormsModule]
})
export class RegisterComponent {
  registerForm: FormGroup; // Definición de la propiedad del formulario
  error: string | null = null; // Para mostrar errores

  loading = false;

  constructor(private fb: FormBuilder) {
    // Inicialización del formulario
    this.registerForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  onSubmit() {
    if (this.registerForm.valid) {
      console.log(this.registerForm.value);
      // Lógica para registrar al usuario
    } else {
      this.error = 'Por favor, completa todos los campos correctamente.';
    }
  }
}
