import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

// Importar los componentes
import { HomeComponent } from './pages/home/home.component';
import { LoginComponent } from './pages/login/login.component';
import { RegisterComponent } from './pages/register/register.component';
import { WorkshopRequestComponent } from './pages/workshop-request/workshop-request.component';
import { DashboardUserComponent } from './pages/dashboard-user/dashboard-user.component';
import { DashboardWorkshopComponent } from './pages/dashboard-workshop/dashboard-workshop.component';
import { AppointmentsComponent } from './pages/appointments/appointments.component';
import { HistoryComponent } from './pages/history/history.component';
import { VehicleManagementComponent } from './pages/vehicle-management/vehicle-management.component';
import { WorkshopManagementComponent } from './pages/workshop-management/workshop-management.component';
import { StatisticsComponent } from './pages/statistics/statistics.component';
import { InventoryComponent } from './pages/inventory/inventory.component';
import { AdminComponent } from './pages/admin/admin.component';
import { SupportComponent } from './pages/support/support.component';
import { NotificationPreferencesComponent } from './pages/notification-preferences/notification-preferences.component';
import { ServiceReviewComponent } from './pages/service-review/service-review.component';
import { RecurringAppointmentsComponent } from './pages/recurring-appointments/recurring-appointments.component';
import { RoleManagementComponent } from './pages/role-management/role-management.component';
import { ServicePricingComponent } from './pages/service-pricing/service-pricing.component';
import { PaymentManagementComponent } from './pages/payment-management/payment-management.component';
import { ReportsComponent } from './pages/reports/reports.component';
import { SecurityAccessControlComponent } from './pages/security-access-control/security-access-control.component';
import { SupplierManagementComponent } from './pages/supplier-management/supplier-management.component';
import { DiscountsPromotionsComponent } from './pages/discounts-promotions/discounts-promotions.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'workshop-request', component: WorkshopRequestComponent },
  { path: 'dashboard-user', component: DashboardUserComponent },
  { path: 'dashboard-workshop', component: DashboardWorkshopComponent },
  { path: 'appointments', component: AppointmentsComponent },
  { path: 'history', component: HistoryComponent },
  { path: 'vehicle-management', component: VehicleManagementComponent },
  { path: 'workshop-management', component: WorkshopManagementComponent },
  { path: 'statistics', component: StatisticsComponent },
  { path: 'inventory', component: InventoryComponent },
  { path: 'admin', component: AdminComponent },
  { path: 'support', component: SupportComponent },
  { path: 'notification-preferences', component: NotificationPreferencesComponent },
  { path: 'service-review', component: ServiceReviewComponent },
  { path: 'recurring-appointments', component: RecurringAppointmentsComponent },
  { path: 'role-management', component: RoleManagementComponent },
  { path: 'service-pricing', component: ServicePricingComponent },
  { path: 'payment-management', component: PaymentManagementComponent },
  { path: 'reports', component: ReportsComponent },
  { path: 'security-access-control', component: SecurityAccessControlComponent },
  { path: 'supplier-management', component: SupplierManagementComponent },
  { path: 'discounts-promotions', component: DiscountsPromotionsComponent },
  { path: '**', redirectTo: '', pathMatch: 'full' } // Ruta para redirigir a la home en caso de ruta no válida
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
