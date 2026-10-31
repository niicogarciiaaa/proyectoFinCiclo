import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DataAccessService } from '../../services/dataAccess.service';

/**
 * Mapa de calor de la demanda: citas por día de la semana y hora de inicio,
 * para organizar los turnos. Se calcula con las citas que ya devuelve la
 * agenda; las canceladas no cuentan.
 */
@Component({
  selector: 'app-mapa-demanda',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mapa-demanda.component.html',
  styleUrl: './mapa-demanda.component.css',
})
export class MapaDemandaComponent implements OnInit {
  readonly dias = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  readonly nombresDia = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
  meses = 6;
  horas: number[] = [];
  /** [día][hora] → nº de citas */
  celdas: number[][] = [];
  max = 0;
  total = 0;
  punta = '';
  tranquilo = '';
  error = '';
  private citas: { StartDateTime: string; Status: string }[] = [];

  constructor(private dataAccess: DataAccessService) {}

  ngOnInit(): void {
    this.dataAccess.obtenerCitasTallerAgenda().subscribe({
      next: (res) => {
        this.citas = res?.citas || [];
        this.calcular();
      },
      error: () => (this.error = 'No se pudo cargar la demanda'),
    });
  }

  calcular(): void {
    const desde = new Date();
    desde.setMonth(desde.getMonth() - this.meses);
    const conteo: { [clave: string]: number } = {};
    const usadas = new Set<number>();
    this.total = 0;
    for (const c of this.citas) {
      const d = new Date(c.StartDateTime.replace(' ', 'T'));
      if (c.Status === 'Cancelada' || isNaN(d.getTime()) || d < desde) continue;
      const dia = (d.getDay() + 6) % 7; // lunes = 0
      const hora = d.getHours();
      conteo[`${dia}-${hora}`] = (conteo[`${dia}-${hora}`] || 0) + 1;
      usadas.add(hora);
      this.total++;
    }
    if (!usadas.size) {
      this.horas = [];
      this.celdas = [];
      this.max = 0;
      this.punta = this.tranquilo = '';
      return;
    }
    const min = Math.min(...usadas);
    const top = Math.max(...usadas);
    this.horas = Array.from({ length: top - min + 1 }, (_, i) => min + i);
    this.celdas = this.dias.map((_, d) => this.horas.map((h) => conteo[`${d}-${h}`] || 0));
    this.max = Math.max(...this.celdas.flat());

    const [dP, hP] = Object.entries(conteo).sort((a, b) => b[1] - a[1])[0][0].split('-').map(Number);
    this.punta = `${this.nombresDia[dP]} a las ${hP}:00`;
    // Día laborable con menos citas (entre los que tienen actividad o de lunes a viernes)
    const porDia = this.celdas.map((f) => f.reduce((s, n) => s + n, 0));
    const candidatos = porDia.map((n, i) => ({ n, i })).filter((x) => x.i < 5 || x.n > 0);
    this.tranquilo = this.nombresDia[candidatos.sort((a, b) => a.n - b.n)[0].i];
  }

  /** Intensidad 0..1 → naranja más o menos fuerte. */
  fondo(n: number): string {
    if (!n || !this.max) return '#f3f4f6';
    return `rgba(251, 140, 0, ${(0.15 + 0.85 * (n / this.max)).toFixed(2)})`;
  }

  texto(n: number): string {
    return this.max && n / this.max > 0.6 ? '#fff' : '#374151';
  }
}
