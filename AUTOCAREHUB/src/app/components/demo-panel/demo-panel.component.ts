import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DataAccessService } from '../../services/dataAccess.service';

/**
 * (Taller) Modo demostración: crea datos de ejemplo (clientes ficticios, citas,
 * facturas, reseñas y coches en el taller) y los borra después sin tocar lo real.
 */
@Component({
  selector: 'app-demo-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './demo-panel.component.html',
  styleUrl: './demo-panel.component.css',
})
export class DemoPanelComponent implements OnInit {
  demo: { Clientes: number; Citas: number; Facturas: number } | null = null;
  trabajando = false;
  mensaje = '';
  error = '';

  constructor(private dataAccess: DataAccessService) {}

  ngOnInit(): void {
    this.dataAccess.estadoDemo().subscribe({
      next: (res) => (this.demo = res?.demo ?? null),
      error: (e) => (this.error = e.message),
    });
  }

  get activo(): boolean {
    return (this.demo?.Clientes ?? 0) > 0;
  }

  crear(): void {
    if (!confirm('Se crearán clientes ficticios, citas y facturas en tu taller. Aparecerán en las estadísticas y en la exportación hasta que los borres. ¿Continuar?')) return;
    this.ejecutar('crear');
  }

  borrar(): void {
    if (!confirm('Se borrarán todos los datos de demostración. Tus datos reales no se tocan. ¿Continuar?')) return;
    this.ejecutar('borrar');
  }

  private ejecutar(accion: 'crear' | 'borrar'): void {
    this.trabajando = true;
    this.error = '';
    this.mensaje = '';
    (accion === 'crear' ? this.dataAccess.crearDemo() : this.dataAccess.borrarDemo()).subscribe({
      next: (res) => {
        this.trabajando = false;
        this.demo = res?.demo ?? null;
        this.mensaje = res?.message || '';
      },
      error: (e) => {
        this.trabajando = false;
        this.error = e.message;
      },
    });
  }
}
