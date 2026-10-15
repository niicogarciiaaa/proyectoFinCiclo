import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component'; // Importa el componente de login
import { authGuard, guestGuard, roleGuard } from './services/auth.guards';

/**
 * Rutas de la aplicación.
 * Salvo el login, todas las pantallas se cargan de forma diferida
 * (loadComponent): el navegador solo descarga el código de cada pantalla
 * cuando se visita, y librerías pesadas como jsPDF no se bajan al abrir la web.
 */
export const routes: Routes = [
    // Rutas públicas
    { path: 'login', component: LoginComponent, canActivate: [guestGuard] },
    { path: '', redirectTo: '/login', pathMatch: 'full' },
    {
        path: 'register', canActivate: [guestGuard],
        loadComponent: () => import('./components/register/register.component').then(m => m.RegisterComponent),
    },

    // Cualquier usuario autenticado
    {
        path: 'home', canActivate: [authGuard],
        loadComponent: () => import('./components/home/home.component').then(m => m.HomeComponent),
    },
    {
        path: 'chat', canActivate: [roleGuard(['Usuario', 'Taller'])],
        loadComponent: () => import('./components/chat/chat.component').then(m => m.ChatComponent),
    },

    // Solo clientes (Usuario)
    {
        path: 'makeAppointment', canActivate: [roleGuard(['Usuario'])],
        loadComponent: () => import('./components/make-appointment/make-appointment.component').then(m => m.MakeAppointmentComponent),
    },
    {
        path: 'registerVehicle', canActivate: [roleGuard(['Usuario'])],
        loadComponent: () => import('./components/register-vehicle/register-vehicle.component').then(m => m.RegisterVehicleComponent),
    },
    {
        path: 'invoiceViewer', canActivate: [roleGuard(['Usuario'])],
        loadComponent: () => import('./components/invoice-viewer/invoice-viewer.component').then(m => m.InvoiceViewerComponent),
    },
    {
        path: 'misCitas', canActivate: [roleGuard(['Usuario'])],
        loadComponent: () => import('./components/my-appointments/my-appointments.component').then(m => m.MyAppointmentsComponent),
    },
    {
        path: 'historialVehiculo', canActivate: [roleGuard(['Usuario'])],
        loadComponent: () => import('./components/vehicle-history/vehicle-history.component').then(m => m.VehicleHistoryComponent),
    },

    // Solo talleres (Taller)
    {
        path: 'viewAppointments', canActivate: [roleGuard(['Taller'])],
        loadComponent: () => import('./components/appointments-viewer/appointments-viewer.component').then(m => m.AppointmentsViewerComponent),
    },
    {
        path: 'invoiceGenerator', canActivate: [roleGuard(['Taller'])],
        loadComponent: () => import('./components/invoices-generator/invoices-generator.component').then(m => m.InvoicesGeneratorComponent),
    },
    {
        path: 'statistics', canActivate: [roleGuard(['Taller'])],
        loadComponent: () => import('./components/statistics-viewer/statistics-viewer.component').then(m => m.StatisticsViewerComponent),
    },
    {
        path: 'agendaConfig', canActivate: [roleGuard(['Taller'])],
        loadComponent: () => import('./components/agenda-config/agenda-config.component').then(m => m.AgendaConfigComponent),
    },
    {
        path: 'taller3d', canActivate: [roleGuard(['Taller'])],
        loadComponent: () => import('./components/workshop-3d/workshop-3d.component').then(m => m.Workshop3dComponent),
    },
    {
        path: 'agendaSemanal', canActivate: [roleGuard(['Taller'])],
        loadComponent: () => import('./components/workshop-agenda/workshop-agenda.component').then(m => m.WorkshopAgendaComponent),
    },

    // Solo administrador
    {
        path: 'workshops-management', canActivate: [roleGuard(['Administrador'])],
        loadComponent: () => import('./components/workshops-management/workshops-management.component').then(m => m.WorkshopsManagementComponent),
    },

    // Comodín: cualquier ruta desconocida → login
    { path: '**', redirectTo: '/login' },
];
