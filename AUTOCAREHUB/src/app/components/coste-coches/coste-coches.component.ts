import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { DataAccessService } from '../../services/dataAccess.service';

interface Entrada {
  StartDateTime: string;
  Service: string;
  InvoiceID: number | null;
  InvoiceDate: string | null;
  TotalAmount: number | string | null;
  InvoiceStatus: string | null;
}

interface FilaCoche {
  id: number;
  nombre: string;
  total: number;
  esteAnyo: number;
  facturas: number;
  ultima: string | null;
}

/**
 * Coste total por coche: compara lo facturado en todos los vehículos del
 * cliente y desglosa por año y por servicio el vehículo seleccionado. Usa el
 * historial que ya existía; las facturas canceladas no cuentan.
 */
@Component({
  selector: 'app-coste-coches',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './coste-coches.component.html',
  styleUrl: './coste-coches.component.css',
})
export class CosteCochesComponent implements OnChanges {
  @Input() vehiculos: any[] = [];
  @Input() vehiculoId = 0;

  filas: FilaCoche[] = [];
  private historiales = new Map<number, Entrada[]>();
  porAnyo: { etiqueta: string; total: number; pct: number }[] = [];
  porServicio: { etiqueta: string; total: number; pct: number }[] = [];
  private cargados = 0;
  readonly anyoActual = new Date().getFullYear();

  constructor(private dataAccess: DataAccessService) {}

  ngOnChanges(): void {
    if (this.vehiculos.length && this.cargados !== this.vehiculos.length) {
      this.cargados = this.vehiculos.length;
      forkJoin(
        this.vehiculos.map((v) =>
          this.dataAccess.obtenerHistorialVehiculo(v.VehicleID).pipe(catchError(() => of(null)))
        )
      ).subscribe((res) => {
        this.vehiculos.forEach((v, i) => this.historiales.set(v.VehicleID, res[i]?.historial || []));
        this.filas = this.vehiculos
          .map((v) => this.filaCoche(v))
          .sort((a, b) => b.total - a.total);
        this.desglosar();
      });
    } else {
      this.desglosar();
    }
  }

  get totalGeneral(): number {
    return this.filas.reduce((s, f) => s + f.total, 0);
  }

  euros(n: number): string {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0);
  }

  fecha(d: string | null): string {
    if (!d) return '—';
    const [a, m, dia] = d.substring(0, 10).split('-');
    return `${dia}/${m}/${a}`;
  }

  private facturadas(lista: Entrada[]): Entrada[] {
    return lista.filter((h) => h.InvoiceID && h.InvoiceStatus !== 'Cancelado');
  }

  private filaCoche(v: any): FilaCoche {
    const f = this.facturadas(this.historiales.get(v.VehicleID) || []);
    const fechaDe = (h: Entrada) => h.InvoiceDate || h.StartDateTime;
    return {
      id: v.VehicleID,
      nombre: `${v.marca} ${v.modelo} · ${v.matricula}`,
      total: f.reduce((s, h) => s + Number(h.TotalAmount || 0), 0),
      esteAnyo: f.filter((h) => fechaDe(h).startsWith(String(this.anyoActual)))
        .reduce((s, h) => s + Number(h.TotalAmount || 0), 0),
      facturas: f.length,
      ultima: f.map(fechaDe).sort().pop() ?? null,
    };
  }

  private desglosar(): void {
    const f = this.facturadas(this.historiales.get(this.vehiculoId) || []);
    const anyos = new Map<string, number>();
    const servicios = new Map<string, number>();
    for (const h of f) {
      const importe = Number(h.TotalAmount || 0);
      const anyo = (h.InvoiceDate || h.StartDateTime).substring(0, 4);
      anyos.set(anyo, (anyos.get(anyo) || 0) + importe);
      servicios.set(h.Service, (servicios.get(h.Service) || 0) + importe);
    }
    this.porAnyo = this.barras([...anyos.entries()].sort((a, b) => b[0].localeCompare(a[0])));
    this.porServicio = this.barras([...servicios.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6));
  }

  private barras(pares: [string, number][]) {
    const max = Math.max(...pares.map((p) => p[1]), 1);
    return pares.map(([etiqueta, total]) => ({ etiqueta, total, pct: Math.round((total / max) * 100) }));
  }
}
