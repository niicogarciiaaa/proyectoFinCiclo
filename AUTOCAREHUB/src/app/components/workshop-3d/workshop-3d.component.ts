import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DataAccessService } from '../../services/dataAccess.service';
import { MenuComponent } from '../menu/menu.component';
import {
  CocheEnTaller,
  Distribucion,
  GarageScene,
  Puesto,
  PUESTOS_ELEVABLES,
  TipoPuesto,
} from './garage-scene';

interface CochePendiente {
  AppointmentID: number;
  StartDateTime: string;
  EndDateTime: string;
  Service: string;
  Status: string;
  Marca: string;
  Modelo: string;
  Anyo: number;
  Matricula: string;
  UserName: string;
}

interface CocheColocado extends CocheEnTaller {
  StartDateTime: string;
  EndDateTime: string;
  Anyo: number;
  UserName: string;
}

interface Ficha {
  detalle: {
    AppointmentID: number;
    StartDateTime: string;
    EndDateTime: string;
    Service: string;
    Status: string;
    Description: string;
    VehicleID: number;
    Marca: string;
    Modelo: string;
    Anyo: number;
    Matricula: string;
    UserName: string;
    UserEmail: string;
    InvoiceID: number | null;
  };
  puesto: { BayKey: string; CarColor: string; Lifted: number | boolean } | null;
  visitas: { AppointmentID: number; StartDateTime: string; Service: string; Status: string }[];
  notas: { NoteID: number; Note: string; CreatedAt: string }[];
}

/**
 * «Taller en 3D»: vista tridimensional del taller con sus elevadores y
 * puestos, los coches que hay dentro, su ficha con notas y un editor
 * para personalizar por completo la distribución.
 */
@Component({
  selector: 'app-workshop-3d',
  standalone: true,
  imports: [CommonModule, FormsModule, MenuComponent],
  templateUrl: './workshop-3d.component.html',
  styleUrl: './workshop-3d.component.css',
})
export class Workshop3dComponent implements AfterViewInit, OnDestroy {
  @ViewChild('visor', { static: true }) visor!: ElementRef<HTMLDivElement>;

  private escena: GarageScene | null = null;

  readonly tipos: { valor: TipoPuesto; nombre: string; icono: string }[] = [
    { valor: 'elevador2', nombre: 'Elevador 2 columnas', icono: 'bi-arrow-up-square' },
    { valor: 'elevador4', nombre: 'Elevador 4 columnas', icono: 'bi-grid-3x3' },
    { valor: 'foso', nombre: 'Foso', icono: 'bi-dash-square' },
    { valor: 'plaza', nombre: 'Plaza / espera', icono: 'bi-p-square' },
    { valor: 'lavado', nombre: 'Lavado', icono: 'bi-droplet' },
  ];
  readonly coloresCoche = ['#1976d2', '#d32f2f', '#388e3c', '#f5f5f5', '#212121', '#7b1fa2', '#ffa000', '#455a64', '#00838f', '#c0c0c0'];

  fecha = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD local
  cargando = true;
  error = '';
  aviso = '';

  layout: Distribucion | null = null;
  coches: CocheColocado[] = [];
  pendientes: CochePendiente[] = [];

  // Selección de coche y ficha
  cocheSel: number | null = null;
  ficha: Ficha | null = null;
  cargandoFicha = false;
  nuevaNota = '';
  puestoDestino: { [appointmentId: number]: string } = {};

  // Modo edición de la distribución
  editando = false;
  layoutEdit: Distribucion | null = null;
  puestoSel: string | null = null;
  hayCambios = false;

  constructor(
    private dataAccess: DataAccessService,
    private zone: NgZone,
    private router: Router
  ) {}

  ngAfterViewInit(): void {
    // El bucle de render va fuera de Angular para no lanzar detección de cambios en cada frame.
    this.zone.runOutsideAngular(() => {
      this.escena = new GarageScene(this.visor.nativeElement, {
        onSelectCar: (id) => this.zone.run(() => this.seleccionarCoche(id)),
        onSelectBay: (key) => this.zone.run(() => (this.puestoSel = key)),
        onBayMoved: (key, x, z) => this.zone.run(() => this.puestoMovido(key, x, z)),
      });
    });
    this.cargar();
  }

  ngOnDestroy(): void {
    this.escena?.dispose();
  }

  // =================================================================
  //  Carga de datos
  // =================================================================

  cargar(): void {
    this.cargando = true;
    this.error = '';
    this.dataAccess.obtenerTaller3D(this.fecha).subscribe({
      next: (res) => {
        this.cargando = false;
        if (!res?.success) {
          this.error = res?.message || 'No se pudo cargar el taller';
          return;
        }
        this.layout = res.layout;
        this.coches = res.coches || [];
        this.pendientes = res.pendientes || [];
        if (!this.editando) {
          this.escena?.setLayout(this.layout!);
        }
        this.escena?.setCars(this.coches);
        if (this.cocheSel && !this.coches.some((c) => c.AppointmentID === this.cocheSel)) {
          // El coche seleccionado ya no está en un puesto: mantener su ficha abierta.
          this.escena?.selectCar(null);
        }
      },
      error: (e) => {
        this.cargando = false;
        this.error = e.message || 'Error al cargar el taller';
      },
    });
  }

  // =================================================================
  //  Coches: meter, mover, elevar, color, sacar
  // =================================================================

  /** Puestos sin coche (más el actual del coche indicado, si lo tiene). */
  puestosLibres(appointmentId?: number): Puesto[] {
    if (!this.layout) return [];
    const ocupados = new Set(this.coches.filter((c) => c.AppointmentID !== appointmentId).map((c) => c.BayKey));
    return this.layout.puestos.filter((p) => !ocupados.has(p.key));
  }

  meterEnTaller(c: CochePendiente): void {
    const libres = this.puestosLibres();
    const destino = this.puestoDestino[c.AppointmentID] || libres[0]?.key;
    if (!destino) {
      this.mostrarAviso('No hay puestos libres. Saca algún coche o añade puestos.', true);
      return;
    }
    this.dataAccess.asignarPuesto(c.AppointmentID, destino).subscribe({
      next: (res) => {
        this.coches = res.coches || this.coches;
        this.pendientes = this.pendientes.filter((p) => p.AppointmentID !== c.AppointmentID);
        this.escena?.setCars(this.coches);
        this.seleccionarCoche(c.AppointmentID);
        this.escena?.selectCar(c.AppointmentID);
        this.mostrarAviso(`${c.Matricula} colocado en ${this.nombrePuesto(destino)}`);
      },
      error: (e) => this.mostrarAviso(e.message, true),
    });
  }

  moverA(bayKey: string): void {
    const id = this.cocheSel;
    if (!id || !bayKey) return;
    this.dataAccess.asignarPuesto(id, bayKey).subscribe({
      next: (res) => {
        this.coches = res.coches || this.coches;
        this.escena?.setCars(this.coches);
        this.escena?.selectCar(id);
        if (this.ficha?.puesto) this.ficha.puesto.BayKey = bayKey;
        this.mostrarAviso(`Movido a ${this.nombrePuesto(bayKey)}`);
      },
      error: (e) => this.mostrarAviso(e.message, true),
    });
  }

  alternarElevador(): void {
    const coche = this.cocheColocado;
    if (!coche) return;
    const lifted = !coche.Lifted;
    this.dataAccess.actualizarCocheTaller(coche.AppointmentID, { Lifted: lifted }).subscribe({
      next: () => {
        coche.Lifted = lifted;
        this.escena?.setCars(this.coches);
        this.escena?.selectCar(coche.AppointmentID);
      },
      error: (e) => this.mostrarAviso(e.message, true),
    });
  }

  cambiarColor(color: string): void {
    const coche = this.cocheColocado;
    if (!coche) return;
    this.dataAccess.actualizarCocheTaller(coche.AppointmentID, { CarColor: color }).subscribe({
      next: () => {
        coche.CarColor = color;
        this.escena?.setCars(this.coches);
        this.escena?.selectCar(coche.AppointmentID);
      },
      error: (e) => this.mostrarAviso(e.message, true),
    });
  }

  sacarDelTaller(): void {
    const coche = this.cocheColocado;
    if (!coche || !confirm(`¿Sacar ${coche.Matricula} del taller?`)) return;
    this.dataAccess.retirarCocheTaller(coche.AppointmentID).subscribe({
      next: () => {
        this.cerrarFicha();
        this.cargar();
        this.mostrarAviso(`${coche.Matricula} ha salido del taller`);
      },
      error: (e) => this.mostrarAviso(e.message, true),
    });
  }

  /** Confirmar / finalizar la cita desde la ficha (usa la llamada de la agenda). */
  cambiarEstado(estado: string): void {
    const f = this.ficha;
    if (!f) return;
    this.dataAccess.cambiarEstadoCita(f.detalle.AppointmentID, estado).subscribe({
      next: (res) => {
        if (!res?.success) {
          this.mostrarAviso(res?.message || 'No se pudo cambiar el estado', true);
          return;
        }
        f.detalle.Status = estado;
        const coche = this.coches.find((c) => c.AppointmentID === f.detalle.AppointmentID);
        if (coche) {
          coche.Status = estado;
          this.escena?.setCars(this.coches);
          this.escena?.selectCar(coche.AppointmentID);
        }
        this.mostrarAviso(`Cita ${estado.toLowerCase()}`);
      },
      error: () => this.mostrarAviso('Error al cambiar el estado', true),
    });
  }

  facturar(): void {
    if (!this.ficha) return;
    this.router.navigate(['/invoiceGenerator'], { queryParams: { appointmentId: this.ficha.detalle.AppointmentID } });
  }

  // =================================================================
  //  Ficha y notas
  // =================================================================

  seleccionarCoche(id: number | null): void {
    this.cocheSel = id;
    this.nuevaNota = '';
    if (id === null) {
      this.ficha = null;
      return;
    }
    this.cargandoFicha = true;
    this.dataAccess.obtenerFichaCoche(id).subscribe({
      next: (res) => {
        this.cargandoFicha = false;
        this.ficha = res?.success ? res : null;
      },
      error: (e) => {
        this.cargandoFicha = false;
        this.mostrarAviso(e.message, true);
      },
    });
  }

  /** Abre la ficha de un coche desde las listas del panel. */
  abrirDesdeLista(id: number): void {
    this.escena?.selectCar(id);
    this.escena?.enfocarCoche(id);
    this.seleccionarCoche(id);
  }

  cerrarFicha(): void {
    this.escena?.selectCar(null);
    this.seleccionarCoche(null);
  }

  guardarNota(): void {
    const texto = this.nuevaNota.trim();
    if (!texto || !this.ficha) return;
    this.dataAccess.crearNotaCoche(this.ficha.detalle.AppointmentID, texto).subscribe({
      next: (res) => {
        if (this.ficha) this.ficha.notas = res.notas || [];
        this.nuevaNota = '';
      },
      error: (e) => this.mostrarAviso(e.message, true),
    });
  }

  borrarNota(noteId: number): void {
    if (!confirm('¿Borrar esta nota?')) return;
    this.dataAccess.eliminarNotaCoche(noteId).subscribe({
      next: () => {
        if (this.ficha) this.ficha.notas = this.ficha.notas.filter((n) => n.NoteID !== noteId);
      },
      error: (e) => this.mostrarAviso(e.message, true),
    });
  }

  get cocheColocado(): CocheColocado | undefined {
    return this.coches.find((c) => c.AppointmentID === this.cocheSel);
  }

  get puestoDelCoche(): Puesto | undefined {
    const c = this.cocheColocado;
    return c ? this.layout?.puestos.find((p) => p.key === c.BayKey) : undefined;
  }

  get esElevable(): boolean {
    const p = this.puestoDelCoche;
    return !!p && PUESTOS_ELEVABLES.includes(p.tipo);
  }

  // =================================================================
  //  Editor de la distribución
  // =================================================================

  entrarEdicion(): void {
    if (!this.layout) return;
    this.cerrarFicha();
    this.editando = true;
    this.hayCambios = false;
    this.layoutEdit = JSON.parse(JSON.stringify(this.layout));
    this.puestoSel = null;
    this.escena?.setEditMode(true);
  }

  descartarEdicion(): void {
    if (this.hayCambios && !confirm('¿Descartar los cambios de la distribución?')) return;
    this.salirEdicion();
    if (this.layout) this.escena?.setLayout(this.layout);
  }

  guardarEdicion(): void {
    if (!this.layoutEdit) return;
    const ocupadosBorrados = this.coches.filter((c) => !this.layoutEdit!.puestos.some((p) => p.key === c.BayKey));
    if (ocupadosBorrados.length &&
        !confirm(`Has borrado puestos con coche (${ocupadosBorrados.map((c) => c.Matricula).join(', ')}). Esos coches volverán a «Por colocar». ¿Guardar?`)) {
      return;
    }
    this.dataAccess.guardarDistribucionTaller(this.layoutEdit).subscribe({
      next: (res) => {
        this.layout = res.layout;
        this.salirEdicion();
        this.escena?.setLayout(this.layout!);
        this.cargar();
        this.mostrarAviso('Distribución guardada');
      },
      error: (e) => this.mostrarAviso(e.message, true),
    });
  }

  restablecer(): void {
    if (!confirm('¿Volver a la distribución por defecto? Se perderá tu distribución actual.')) return;
    this.dataAccess.restablecerDistribucionTaller().subscribe({
      next: (res) => {
        this.layout = res.layout;
        this.salirEdicion();
        this.escena?.setLayout(this.layout!, true);
        this.cargar();
        this.mostrarAviso('Distribución restablecida');
      },
      error: (e) => this.mostrarAviso(e.message, true),
    });
  }

  private salirEdicion(): void {
    this.editando = false;
    this.layoutEdit = null;
    this.puestoSel = null;
    this.hayCambios = false;
    this.escena?.setEditMode(false);
    this.escena?.selectBay(null);
  }

  /** Redibuja la escena con la distribución que se está editando. */
  aplicarEdicion(recolocarCamara = false): void {
    if (!this.layoutEdit) return;
    this.hayCambios = true;
    this.escena?.setLayout(this.layoutEdit, recolocarCamara);
    this.escena?.selectBay(this.puestoSel);
  }

  anadirPuesto(tipo: TipoPuesto): void {
    if (!this.layoutEdit) return;
    if (this.layoutEdit.puestos.length >= 40) {
      this.mostrarAviso('Máximo 40 puestos', true);
      return;
    }
    const nombre = this.tipos.find((t) => t.valor === tipo)?.nombre.split(' ')[0] || 'Puesto';
    const mismos = this.layoutEdit.puestos.filter((p) => p.tipo === tipo).length + 1;
    const nuevo: Puesto = {
      key: `${tipo}-${Date.now().toString(36)}`,
      tipo,
      etiqueta: `${nombre} ${mismos}`,
      x: 0,
      z: 0,
      rot: 0,
    };
    this.layoutEdit.puestos.push(nuevo);
    this.puestoSel = nuevo.key;
    this.aplicarEdicion();
    this.mostrarAviso('Puesto añadido en el centro: arrástralo a su sitio');
  }

  get puestoEditado(): Puesto | undefined {
    return this.layoutEdit?.puestos.find((p) => p.key === this.puestoSel);
  }

  girar(grados: number): void {
    const p = this.puestoEditado;
    if (!p) return;
    p.rot = (((p.rot + grados) % 360) + 360) % 360;
    this.aplicarEdicion();
  }

  duplicarPuesto(): void {
    const p = this.puestoEditado;
    if (!p || !this.layoutEdit) return;
    const copia: Puesto = { ...p, key: `${p.tipo}-${Date.now().toString(36)}`, etiqueta: p.etiqueta + ' (copia)', x: p.x + 4 };
    this.layoutEdit.puestos.push(copia);
    this.puestoSel = copia.key;
    this.aplicarEdicion();
  }

  borrarPuesto(): void {
    const p = this.puestoEditado;
    if (!p || !this.layoutEdit) return;
    this.layoutEdit.puestos = this.layoutEdit.puestos.filter((x) => x.key !== p.key);
    this.puestoSel = null;
    this.aplicarEdicion();
  }

  quitarColorPuesto(): void {
    const p = this.puestoEditado;
    if (!p) return;
    delete p.color;
    this.aplicarEdicion();
  }

  private puestoMovido(key: string, x: number, z: number): void {
    const p = this.layoutEdit?.puestos.find((q) => q.key === key);
    if (p) {
      p.x = Math.round(x * 100) / 100;
      p.z = Math.round(z * 100) / 100;
      this.hayCambios = true;
    }
  }

  // =================================================================
  //  Cámara y presentación
  // =================================================================

  vistaInicial(): void {
    this.escena?.vistaInicial();
  }

  vistaPlanta(): void {
    this.escena?.vistaPlanta();
  }

  cambiarFecha(): void {
    this.cargar();
  }

  nombrePuesto(key: string): string {
    return this.layout?.puestos.find((p) => p.key === key)?.etiqueta || key;
  }

  nombreTipo(tipo: TipoPuesto): string {
    return this.tipos.find((t) => t.valor === tipo)?.nombre || tipo;
  }

  hora(dt: string): string {
    return dt ? dt.substring(11, 16) : '';
  }

  fechaCorta(dt: string): string {
    return new Date(dt.replace(' ', 'T')).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  claseEstado(estado: string): string {
    return 'st-' + (estado || 'pendiente').toLowerCase();
  }

  private mostrarAviso(msg: string, esError = false): void {
    if (esError) {
      this.error = msg;
      setTimeout(() => (this.error = ''), 5000);
    } else {
      this.aviso = msg;
      setTimeout(() => (this.aviso = ''), 3000);
    }
  }
}
