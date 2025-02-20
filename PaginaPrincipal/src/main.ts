import { bootstrapApplication } from '@angular/platform-browser';

import { importProvidersFrom } from '@angular/core';

import { ReactiveFormsModule } from '@angular/forms';
import { AppComponent } from './app/app.component';
import { AppRoutingModule } from './app/app.routes';

bootstrapApplication(AppComponent, {
  providers: [
    importProvidersFrom(AppRoutingModule, ReactiveFormsModule)
  ]
})
.catch(err => console.error(err));
