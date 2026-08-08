import { Injectable } from '@angular/core';
import { ES_TEXTS } from '../assets/es';
import { EN_TEXTS } from '../assets/en';

@Injectable({
  providedIn: 'root'
})
export class I18nService {
  public currentLang = 'es'; 

  private translations: any = {
    es: ES_TEXTS,
    en: EN_TEXTS
  };

  setLang(lang: string) {
    this.currentLang = lang;
  }

  t(key: string, vars?: { [key: string]: any }): string {
    const keys = key.split('.');
    let text = this.translations[this.currentLang];
    
    // Navegar por el objeto de traducciones siguiendo la ruta de keys
    for (const k of keys) {
      if (text[k] === undefined) return key;
      text = text[k];
    }

    if (vars) {
      Object.keys(vars).forEach(k => {
        text = text.replace(new RegExp(`{${k}}`, 'g'), vars[k]);
      });
    }
    return text;
  }
}