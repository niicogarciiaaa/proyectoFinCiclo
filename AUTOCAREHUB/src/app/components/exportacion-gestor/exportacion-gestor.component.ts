import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataAccessService } from '../../services/dataAccess.service';
import { descargarExportacionGestor, ExportacionTrimestre } from '../../services/exportacion-gestor';

/**
 * (Taller) Tarjeta «Exportación para el gestor»: elige año y trimestre y
 * descarga un Excel con el resumen de IVA, el libro de IVA repercutido y el
 * listado de facturas.
 */
@Component({
  selector: 'app-exportacion-gestor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './exportacion-gestor.component.html',
  styleUrl: './exportacion-gestor.component.css',
})
export class ExportacionGestorComponent {
  readonly anyos: number[];
  readonly trimestres = [1, 2, 3, 4];
  anyo: number;
  trimestre: number;
  descargando = false;
  error = '';
  /** Resumen de la última descarga, para confirmar qué se ha exportado. */
  ultimo: { etiqueta: string; facturas: number; total: number } | null = null;

  constructor(private dataAccess: DataAccessService) {
    const hoy = new Date();
    this.anyo = hoy.getFullYear();
    this.trimestre = Math.floor(hoy.getMonth() / 3) + 1;
    this.anyos = Array.from({ length: 5 }, (_, i) => this.anyo - i);
  }

  descargar(): void {
    if (this.descargando) return;
    this.descargando = true;
    this.error = '';
    this.dataAccess.obtenerExportacionTrimestre(this.anyo, this.trimestre).subscribe({
      next: (res: ExportacionTrimestre & { success: boolean; message?: string }) => {
        this.descargando = false;
        if (!res?.success) {
          this.error = res?.message || 'No se pudo preparar la exportación';
          return;
        }
        descargarExportacionGestor(res);
        this.ultimo = {
          etiqueta: `${res.periodo.trimestre}T ${res.periodo.anyo}`,
          facturas: res.totales.Facturas,
          total: res.totales.Total,
        };
      },
      error: (e) => {
        this.descargando = false;
        this.error = e.message || 'No se pudo preparar la exportación';
      },
    });
  }

  euros(n: number): string {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0);
  }
}
