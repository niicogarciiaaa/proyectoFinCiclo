import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component'; // Importa el componente de login
import { RegisterComponent } from './components/register/register.component'; // Importa el componente de registro
import { HomeComponent } from './components/home/home.component';

export const routes: Routes = [
    { path: 'login', component: LoginComponent }, // Ruta para el componente de login
    { path: '', redirectTo: '/login', pathMatch: 'full' }, // Redirección a login por defecto
    { path: 'register', component: RegisterComponent }, // Ruta para el componente de registro
    { path: 'home', component: HomeComponent } // Ruta para el componente de registro
];