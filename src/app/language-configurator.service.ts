import { Injectable } from '@angular/core';
import { TextsES } from './texts.es';
import { TextsEN } from './texts.en';

@Injectable({
  providedIn: 'root',
})
export class LanguageConfigurator {
  private lang: 'es' | 'en';

  constructor() {
    this.lang = (sessionStorage.getItem('lang') as 'es' | 'en') ?? 'es';
  }

  setLanguage(lang: 'es' | 'en') {
    this.lang = lang;
    sessionStorage.setItem('lang', lang);
  }

  getLanguage(): 'es' | 'en' {
    return this.lang;
  }

  get texts() {
    return this.lang === 'es' ? TextsES : TextsEN;
  }
}
