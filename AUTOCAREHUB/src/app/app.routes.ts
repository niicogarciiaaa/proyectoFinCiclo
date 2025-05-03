import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component'; // Importa el componente de login
import { RegisterComponent } from './components/register/register.component'; // Importa el componente de registro
import { HomeComponent } from './components/home/home.component';
import { MakeAppointmentComponent } from './components/make-appointment/make-appointment.component';
import { RegisterVehicleComponent } from './components/register-vehicle/register-vehicle.component';
import { AppointmentsViewerComponent } from './components/appointments-viewer/appointments-viewer.component';
import { InvoicesGeneratorComponent } from './components/invoices-generator/invoices-generator.component';

export const routes: Routes = [
    { path: 'login', component: LoginComponent }, // Ruta para el componente de login
    { path: '', redirectTo: '/login', pathMatch: 'full' }, // Redirección a login por defecto
    { path: 'register', component: RegisterComponent }, // Ruta para el componente de registro
    { path: 'home', component: HomeComponent }, // Ruta para el componente de registro
    { path: 'makeAppointment', component: MakeAppointmentComponent }, // Ruta para el componente de registro
    { path: 'registerVehicle', component: RegisterVehicleComponent }, // Ruta para el componente de registro
    {path: 'viewAppointments', component: AppointmentsViewerComponent}, // Ruta para el componente de registro
    {path: 'invoiceGenerator', component: InvoicesGeneratorComponent} // Ruta para el componente de registro
];