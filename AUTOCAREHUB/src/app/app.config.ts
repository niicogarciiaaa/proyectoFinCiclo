import { ApplicationConfig, ErrorHandler, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { ChunkErrorHandler } from './services/chunk-error.handler';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    // Recarga una vez si falta un trozo de código tras desplegar una versión nueva.
    { provide: ErrorHandler, useClass: ChunkErrorHandler },
  ]
};
