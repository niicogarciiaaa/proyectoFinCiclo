import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

// Importa los componentes standalone
import { FooterComponent } from './components/footer/footer.component';
import { NotFoundComponent } from './components/not-found/not-found.component';
import { HomeComponent } from './pages/home/home.component';
import { LoginComponent } from './pages/login/login.component';

// Importa el módulo de enrutamiento y formularios reactivos
import { AppRoutingModule } from './app.routes';
import { ReactiveFormsModule } from '@angular/forms';

@NgModule({
  imports: [
    BrowserModule,
    AppRoutingModule,
    ReactiveFormsModule,
    FooterComponent, // Importa los componentes standalone aquí
    NotFoundComponent,
    HomeComponent,
    LoginComponent
  ],
  providers: [
    provideHttpClient(withInterceptorsFromDi()), // Configura HttpClient con interceptores
  ],
})
export class AppModule { }