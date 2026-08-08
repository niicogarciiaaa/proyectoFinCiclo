import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component'; // Importa el componente de login
import { RegisterComponent } from './components/register/register.component'; // Importa el componente de registro
import { HomeComponent } from './components/home/home.component';
import { MakeAppointmentComponent } from './components/make-appointment/make-appointment.component';
import { RegisterVehicleComponent } from './components/register-vehicle/register-vehicle.component';
import { AppointmentsViewerComponent } from './components/appointments-viewer/appointments-viewer.component';
import { InvoicesGeneratorComponent } from './components/invoices-generator/invoices-generator.component';
import { InvoiceViewerComponent } from './components/invoice-viewer/invoice-viewer.component';
import { StatisticsViewerComponent } from './components/statistics-viewer/statistics-viewer.component';
import { ChatComponent } from './components/chat/chat.component';
import { WorkshopsManagementComponent } from './components/workshops-management/workshops-management.component';
import { AgendaConfigComponent } from './components/agenda-config/agenda-config.component';
import { WorkshopAgendaComponent } from './components/workshop-agenda/workshop-agenda.component';
import { MyAppointmentsComponent } from './components/my-appointments/my-appointments.component';
import { authGuard, roleGuard } from './services/auth.guards';

export const routes: Routes = [
    // Rutas públicas
    { path: 'login', component: LoginComponent },
    { path: '', redirectTo: '/login', pathMatch: 'full' },
    { path: 'register', component: RegisterComponent },

    // Cualquier usuario autenticado
    { path: 'home', component: HomeComponent, canActivate: [authGuard] },
    { path: 'chat', component: ChatComponent, canActivate: [roleGuard(['Usuario', 'Taller'])] },

    // Solo clientes (Usuario)
    { path: 'makeAppointment', component: MakeAppointmentComponent, canActivate: [roleGuard(['Usuario'])] },
    { path: 'registerVehicle', component: RegisterVehicleComponent, canActivate: [roleGuard(['Usuario'])] },
    { path: 'invoiceViewer', component: InvoiceViewerComponent, canActivate: [roleGuard(['Usuario'])] },
    { path: 'misCitas', component: MyAppointmentsComponent, canActivate: [roleGuard(['Usuario'])] },

    // Solo talleres (Taller)
    { path: 'viewAppointments', component: AppointmentsViewerComponent, canActivate: [roleGuard(['Taller'])] },
    { path: 'invoiceGenerator', component: InvoicesGeneratorComponent, canActivate: [roleGuard(['Taller'])] },
    { path: 'statistics', component: StatisticsViewerComponent, canActivate: [roleGuard(['Taller'])] },
    { path: 'agendaConfig', component: AgendaConfigComponent, canActivate: [roleGuard(['Taller'])] },
    { path: 'agendaSemanal', component: WorkshopAgendaComponent, canActivate: [roleGuard(['Taller'])] },

    // Solo administrador
    { path: 'workshops-management', component: WorkshopsManagementComponent, canActivate: [roleGuard(['Administrador'])] },

    // Comodín: cualquier ruta desconocida → login
    { path: '**', redirectTo: '/login' },
];