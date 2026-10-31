import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataAccessService } from '../../services/dataAccess.service';

export interface LineaPlantilla {
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
}

interface Plantilla {
  TemplateID: number;
  Name: string;
  Items: LineaPlantilla[];
}

/**
 * Plantillas de trabajo del generador de facturas: añade de una vez un paquete
 * de conceptos («Revisión completa») o guarda las líneas actuales como plantilla.
 */
@Component({
  selector: 'app-plantillas-factura',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './plantillas-factura.component.html',
  styleUrl: './plantillas-factura.component.css',
})
export class PlantillasFacturaComponent implements OnInit {
  /** Líneas actuales de la factura (para guardarlas como plantilla). */
  @Input() lineas: LineaPlantilla[] = [];
  @Output() aplicar = new EventEmitter<LineaPlantilla[]>();

  plantillas: Plantilla[] = [];
  elegida: number | null = null;
  guardando = false;
  nombre = '';
  mensaje = '';
  error = '';

  constructor(private dataAccess: DataAccessService) {}

  ngOnInit(): void {
    this.dataAccess.listarPlantillas().subscribe({
      next: (res) => (this.plantillas = res?.plantillas || []),
      error: (e) => (this.error = e.message),
    });
  }

  get plantillaElegida(): Plantilla | undefined {
    return this.plantillas.find((p) => p.TemplateID === this.elegida);
  }

  /** Total con IVA de la plantilla, para verlo antes de aplicarla. */
  total(p: Plantilla): number {
    return p.Items.reduce((s, i) => s + i.quantity * i.unit_price * (1 + i.tax_rate / 100), 0);
  }

  usar(): void {
    const p = this.plantillaElegida;
    if (!p) return;
    this.aplicar.emit(p.Items.map((i) => ({ ...i })));
    this.avisar(`«${p.Name}» añadida a la factura (${p.Items.length} ${p.Items.length === 1 ? 'línea' : 'líneas'}). Revisa las líneas antes de crearla.`);
  }

  guardar(): void {
    const nombre = this.nombre.trim();
    if (!nombre || !this.lineas.length) return;
    const repetida = this.plantillas.some((p) => p.Name.toLowerCase() === nombre.toLowerCase());
    if (repetida && !confirm(`Ya hay una plantilla «${nombre}». ¿Sustituirla?`)) return;
    this.dataAccess.guardarPlantilla(nombre, this.lineas).subscribe({
      next: (res) => {
        this.plantillas = res?.plantillas || [];
        this.guardando = false;
        this.nombre = '';
        this.avisar('Plantilla guardada');
      },
      error: (e) => (this.error = e.message),
    });
  }

  borrar(): void {
    const p = this.plantillaElegida;
    if (!p || !confirm(`¿Borrar la plantilla «${p.Name}»?`)) return;
    this.dataAccess.eliminarPlantilla(p.TemplateID).subscribe({
      next: (res) => {
        this.plantillas = res?.plantillas || [];
        this.elegida = null;
        this.avisar('Plantilla borrada');
      },
      error: (e) => (this.error = e.message),
    });
  }

  private avisar(texto: string): void {
    this.error = '';
    this.mensaje = texto;
    setTimeout(() => (this.mensaje = ''), 4000);
  }
}
