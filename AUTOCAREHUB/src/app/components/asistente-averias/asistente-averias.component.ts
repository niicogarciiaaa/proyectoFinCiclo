import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { normalizar } from '../../services/search.util';

interface Sintoma {
  clave: string;
  nombre: string;
  icono: string;
  /** Palabras que lo identifican en el texto libre del cliente. */
  palabras: string[];
  /** Palabras para buscar el servicio en el catálogo del taller. */
  servicios: string[];
  consejo: string;
  urgente?: boolean;
}

const SINTOMAS: Sintoma[] = [
  { clave: 'frenos', nombre: 'Ruido o fallo al frenar', icono: 'bi-exclamation-octagon', urgente: true,
    palabras: ['fren', 'pastilla', 'chirri', 'disco'], servicios: ['fren', 'pastilla', 'disco'],
    consejo: 'Puede ser desgaste de pastillas o discos. Afecta a la seguridad: conviene revisarlo cuanto antes y evitar conducir si el pedal va blando.' },
  { clave: 'testigo', nombre: 'Testigo encendido en el cuadro', icono: 'bi-lightbulb',
    palabras: ['testigo', 'luz', 'piloto', 'cuadro', 'check'], servicios: ['diagnos', 'revision'],
    consejo: 'Hace falta leer el error con una máquina de diagnosis. Si el testigo es rojo o parpadea, para el coche en cuanto puedas.' },
  { clave: 'arranque', nombre: 'No arranca o le cuesta', icono: 'bi-battery-half',
    palabras: ['arranca', 'arranque', 'bateria', 'motor de arranque'], servicios: ['bateria', 'diagnos', 'arranque'],
    consejo: 'Lo más habitual es la batería, sobre todo con frío o tras días parado. El taller puede comprobarla también junto al alternador.' },
  { clave: 'vibracion', nombre: 'Vibra o se va hacia un lado', icono: 'bi-arrow-left-right',
    palabras: ['vibra', 'tira', 'lado', 'volante', 'rueda', 'neumatic', 'pinchaz'], servicios: ['neumatic', 'rueda', 'alinea', 'equilibr'],
    consejo: 'Suele deberse al equilibrado o la alineación, o a neumáticos desgastados. Conviene revisarlo para no gastar las ruedas de forma irregular.' },
  { clave: 'clima', nombre: 'El aire no enfría', icono: 'bi-snow',
    palabras: ['aire', 'climatiz', 'enfria', 'calefaccion', 'ac '], servicios: ['aire', 'climatiz'],
    consejo: 'Normalmente falta gas o hay una pequeña fuga. No suele ser urgente, pero es mejor comprobarlo antes del verano.' },
  { clave: 'fuga', nombre: 'Humo, olor o manchas en el suelo', icono: 'bi-droplet-half', urgente: true,
    palabras: ['humo', 'olor', 'fuga', 'mancha', 'pierde', 'gotea', 'calienta'], servicios: ['diagnos', 'revision', 'aceite'],
    consejo: 'Puede ser una fuga de aceite o refrigerante. Si sube la temperatura o sale humo, no sigas conduciendo.' },
  { clave: 'revision', nombre: 'Hace tiempo que no lo reviso', icono: 'bi-calendar-check',
    palabras: ['revision', 'mantenimiento', 'aceite', 'filtro', 'kilometr'], servicios: ['revision', 'aceite', 'mantenimiento'],
    consejo: 'Una revisión con cambio de aceite y filtros suele recomendarse cada año o cada 15.000 km (consulta el manual de tu coche).' },
  { clave: 'itv', nombre: 'Tengo que pasar la ITV', icono: 'bi-clipboard-check',
    palabras: ['itv', 'inspeccion'], servicios: ['itv', 'revision'],
    consejo: 'Una pre-ITV detecta a tiempo luces, frenos o neumáticos que podrían dar un rechazo.' },
];

/**
 * Asistente para quien no sabe qué servicio pedir: elige un síntoma o lo
 * describe, y recibe una orientación y el servicio del taller que encaja.
 * Es orientativo y va solo en el navegador; el diagnóstico lo hace el taller.
 */
@Component({
  selector: 'app-asistente-averias',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './asistente-averias.component.html',
  styleUrl: './asistente-averias.component.css',
})
export class AsistenteAveriasComponent {
  /** Servicios del taller elegido. */
  @Input() servicios: { ServiceID: number; Name: string }[] = [];
  @Input() hayTaller = false;
  /** Servicio sugerido (0 = cita general) y motivo para la cita. */
  @Output() elegir = new EventEmitter<{ serviceId: number; motivo: string }>();

  readonly sintomas = SINTOMAS;
  abierto = false;
  texto = '';
  seleccionado: Sintoma | null = null;
  sinCoincidencia = false;

  elegirSintoma(s: Sintoma): void {
    this.seleccionado = s;
    this.sinCoincidencia = false;
  }

  /** Busca el síntoma que más palabras comparte con la descripción. */
  analizar(): void {
    const t = normalizar(this.texto);
    if (!t) return;
    let mejor: Sintoma | null = null;
    let puntos = 0;
    for (const s of SINTOMAS) {
      const p = s.palabras.filter((w) => t.includes(w)).length;
      if (p > puntos) {
        puntos = p;
        mejor = s;
      }
    }
    this.seleccionado = mejor;
    this.sinCoincidencia = !mejor;
  }

  /** Servicio del catálogo del taller que encaja con el síntoma. */
  get servicioSugerido(): { ServiceID: number; Name: string } | null {
    if (!this.seleccionado) return null;
    for (const palabra of this.seleccionado.servicios) {
      const s = this.servicios.find((x) => normalizar(x.Name).includes(palabra));
      if (s) return s;
    }
    return null;
  }

  aplicar(): void {
    const motivo = this.texto.trim() || this.seleccionado?.nombre || '';
    this.elegir.emit({ serviceId: this.servicioSugerido?.ServiceID ?? 0, motivo });
    this.abierto = false;
  }
}
