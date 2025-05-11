import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component'; // Importa el componente de login
import { RegisterComponent } from './components/register/register.component'; // Importa el componente de registro
import { HomeComponent } from './components/home/home.component';
import { MakeAppointmentComponent } from './components/make-appointment/make-appointment.component';
import { RegisterVehicleComponent } from './components/register-vehicle/register-vehicle.component';
import { AppointmentsViewerComponent } from './components/appointments-viewer/appointments-viewer.component';
import { InvoicesGeneratorComponent } from './components/invoices-generator/invoices-generator.component';
import { InvoiceViewerComponent } from './components/invoice-viewer/invoice-viewer.component';

export const routes: Routes = [
    { path: 'login', component: LoginComponent }, 
    { path: '', redirectTo: '/login', pathMatch: 'full' }, 
    { path: 'register', component: RegisterComponent }, 
    { path: 'home', component: HomeComponent }, 
    { path: 'makeAppointment', component: MakeAppointmentComponent }, 
    { path: 'registerVehicle', component: RegisterVehicleComponent }, 
    {path: 'viewAppointments', component: AppointmentsViewerComponent}, 
    {path: 'invoiceGenerator', component: InvoicesGeneratorComponent},
    {path: 'invoiceViewer', component: InvoiceViewerComponent}, 
];