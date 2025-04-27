import { Injectable } from '@angular/core';
import { ES_TEXTS } from '../assets/es';
import { EN_TEXTS } from '../assets/en';

@Injectable({
  providedIn: 'root'
})
export class I18nService {
  public currentLang = 'es'; // Cambiado a public para acceso externo

  private translations: any = {
    es: ES_TEXTS,
    en: EN_TEXTS
  };

  setLang(lang: string) {
    this.currentLang = lang;
  }

  t(key: string, vars?: { [key: string]: any }): string {
    let text = this.translations[this.currentLang][key] || key;
    if (vars) {
      Object.keys(vars).forEach(k => {
        text = text.replace(new RegExp(`{${k}}`, 'g'), vars[k]);
      });
    }
    return text;
  }
}