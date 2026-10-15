import { Injectable } from '@angular/core';
import { ES_TEXTS } from '../assets/es';
import { EN_TEXTS } from '../assets/en';

@Injectable({
  providedIn: 'root'
})
export class I18nService {
  private static readonly CLAVE = 'autocarehub-idioma';
  public currentLang = 'es';

  private translations: any = {
    es: ES_TEXTS,
    en: EN_TEXTS
  };

  constructor() {
    // Recordar el idioma elegido entre visitas.
    try {
      const guardado = localStorage.getItem(I18nService.CLAVE);
      if (guardado && this.translations[guardado]) this.currentLang = guardado;
    } catch {
      // Sin almacenamiento disponible: se usa el idioma por defecto.
    }
    document.documentElement.lang = this.currentLang;
  }

  setLang(lang: string) {
    if (!this.translations[lang]) return;
    this.currentLang = lang;
    document.documentElement.lang = lang;
    try {
      localStorage.setItem(I18nService.CLAVE, lang);
    } catch {
      // Ignorar: el idioma solo dura esta visita.
    }
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