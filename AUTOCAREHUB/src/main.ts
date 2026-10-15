// main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { routes } from './app/app.routes';
import { sessionInterceptor } from './app/services/session.interceptor';

bootstrapApplication(AppComponent, {
  providers: [
    // Interceptor: si la sesión del backend caduca (401) vuelve al login.
    provideHttpClient(withInterceptors([sessionInterceptor])),
    provideRouter(routes),
  ]
}).catch((err) => console.error(err));
