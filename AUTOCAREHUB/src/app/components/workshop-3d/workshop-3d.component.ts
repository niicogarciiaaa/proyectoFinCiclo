import { AfterViewInit, Component, ElementRef, HostListener, NgZone, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DataAccessService } from '../../services/dataAccess.service';
import { MenuComponent } from '../menu/menu.component';
import {
  CocheEnTaller,
  cocheConRetraso,
  Distribucion,
  EstadoCamara,
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
  styleUrls: ['./workshop-3d.component.css', './workshop-3d.funciones.css'],
})
export class Workshop3dComponent implements AfterViewInit, OnDestroy {
  @ViewChild('visor', { static: true }) visor!: ElementRef<HTMLDivElement>;
  @ViewChild('visorWrap', { static: true }) visorWrap!: ElementRef<HTMLDivElement>;
  @ViewChild('tooltip') tooltip?: ElementRef<HTMLDivElement>;
  @ViewChild('buscador') buscador?: ElementRef<HTMLInputElement>;

  private readonly CLAVE_CAMARA = 'taller3d.camara';
  private camaraRestaurada = false;

  /** Estados que se pueden filtrar desde la leyenda. */
  readonly estadosLeyenda = ['Pendiente', 'Confirmada', 'Finalizada'];
  /** Estados ocultos (atenuados) en la vista. */
  estadosOcultos = new Set<string>();
  verAtajos = false;

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

  // Aviso flotante al pasar el ratón por un coche
  hover: CocheColocado | null = null;

  // Búsqueda por matrícula, presentación y arrastre desde la lista
  busqueda = '';
  pantallaCompleta = false;
  girando = false;
  arrastrandoPendiente: number | null = null;
  private reloj: ReturnType<typeof setInterval> | null = null;
  private alCambiarPantalla = () => this.zone.run(() => (this.pantallaCompleta = !!document.fullscreenElement));

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
        onCarDropped: (id, key) => this.zone.run(() => this.cocheSoltado(id, key)),
        onHoverCar: (id, x, y) => this.moverAvisoHover(id, x, y),
        onDoubleClickCar: (id) => this.zone.run(() => this.dobleClicCoche(id)),
      });
    });
    window.addEventListener('pagehide', this.guardarCamara);
    this.cargar();
    document.addEventListener('fullscreenchange', this.alCambiarPantalla);
    // Cada minuto se repintan las etiquetas para que aparezcan los retrasos nuevos.
    this.zone.runOutsideAngular(() => {
      this.reloj = setInterval(() => {
        if (!this.editando && this.coches.some((c) => cocheConRetraso(c))) {
          this.escena?.setCars(this.coches);
          this.escena?.selectCar(this.cocheSel);
        }
      }, 60_000);
    });
  }

  ngOnDestroy(): void {
    this.guardarCamara();
    window.removeEventListener('pagehide', this.guardarCamara);
    if (this.reloj) clearInterval(this.reloj);
    document.removeEventListener('fullscreenchange', this.alCambiarPantalla);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
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
          this.restaurarCamara();
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
    if (this.cocheSel) this.moverCoche(this.cocheSel, bayKey);
  }

  /** Mueve un coche ya colocado a otro puesto libre. */
  private moverCoche(id: number, bayKey: string): void {
    if (!bayKey) return;
    this.dataAccess.asignarPuesto(id, bayKey).subscribe({
      next: (res) => {
        this.coches = res.coches || this.coches;
        this.escena?.setCars(this.coches);
        this.escena?.selectCar(this.cocheSel);
        if (this.cocheSel === id && this.ficha?.puesto) this.ficha.puesto.BayKey = bayKey;
        this.mostrarAviso(`Movido a ${this.nombrePuesto(bayKey)}`);
      },
      error: (e) => this.mostrarAviso(e.message, true),
    });
  }

  /** Se ha soltado un coche arrastrado en la vista 3D. */
  private cocheSoltado(id: number, bayKey: string | null): void {
    const coche = this.coches.find((c) => c.AppointmentID === id);
    if (!coche || !bayKey || bayKey === coche.BayKey) return; // vuelve a su sitio
    const otro = this.coches.find((c) => c.BayKey === bayKey);
    if (!otro) {
      this.moverCoche(id, bayKey);
    } else if (confirm(`${this.nombrePuesto(bayKey)} está ocupado por ${otro.Matricula}. ¿Intercambiar los dos coches?`)) {
      this.intercambiar(coche, otro);
    }
  }

  /**
   * Intercambia dos coches de puesto con las llamadas existentes: se saca
   * uno, se mueve el otro y se vuelve a meter el primero (con su color).
   */
  private intercambiar(a: CocheColocado, b: CocheColocado): void {
    const puestoA = a.BayKey;
    const puestoB = b.BayKey;
    const colorB = b.CarColor;
    const fallo = (e: any) => {
      this.mostrarAviso(e?.message || 'No se pudo intercambiar', true);
      this.cargar();
    };
    this.dataAccess.retirarCocheTaller(b.AppointmentID).subscribe({
      next: () => this.dataAccess.asignarPuesto(a.AppointmentID, puestoB).subscribe({
        next: () => this.dataAccess.asignarPuesto(b.AppointmentID, puestoA).subscribe({
          next: () => this.dataAccess.actualizarCocheTaller(b.AppointmentID, { CarColor: colorB }).subscribe({
            next: () => {
              this.cargar();
              this.mostrarAviso(`${a.Matricula} y ${b.Matricula} intercambiados`);
            },
            error: () => this.cargar(),
          }),
          error: fallo,
        }),
        error: fallo,
      }),
      error: fallo,
    });
  }

  /** Doble clic en un coche: sube o baja el elevador (si está en uno). */
  private dobleClicCoche(id: number): void {
    const coche = this.coches.find((c) => c.AppointmentID === id);
    const puesto = coche && this.layout?.puestos.find((p) => p.key === coche.BayKey);
    if (!coche || !puesto || !PUESTOS_ELEVABLES.includes(puesto.tipo)) return;
    if (this.cocheSel !== id) this.seleccionarCoche(id);
    this.cocheSel = id;
    this.alternarElevador();
  }

  // ---------- Arrastrar un coche de «Por colocar» a la vista 3D ----------

  empezarArrastrePendiente(ev: DragEvent, c: CochePendiente): void {
    this.arrastrandoPendiente = c.AppointmentID;
    this.escena?.mostrarLibres(true);
    ev.dataTransfer?.setData('text/plain', String(c.AppointmentID));
    if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move';
  }

  terminarArrastrePendiente(): void {
    this.arrastrandoPendiente = null;
    this.escena?.mostrarLibres(false);
    this.escena?.resaltarPuesto(null);
  }

  sobreVisor(ev: DragEvent): void {
    if (this.arrastrandoPendiente === null || this.editando) return;
    ev.preventDefault(); // permite soltar
    this.escena?.resaltarPuesto(this.escena.puestoEn(ev.clientX, ev.clientY));
  }

  soltarEnVisor(ev: DragEvent): void {
    ev.preventDefault();
    const id = this.arrastrandoPendiente;
    const key = this.escena?.puestoEn(ev.clientX, ev.clientY) ?? null;
    this.terminarArrastrePendiente();
    const c = this.pendientes.find((p) => p.AppointmentID === id);
    if (!c) return;
    if (!key) {
      this.mostrarAviso('Suelta el coche encima de un puesto', true);
      return;
    }
    if (this.coches.some((x) => x.BayKey === key)) {
      this.mostrarAviso(`${this.nombrePuesto(key)} ya está ocupado`, true);
      return;
    }
    this.puestoDestino[c.AppointmentID] = key;
    this.meterEnTaller(c);
  }

  // ---------- Aviso flotante (fuera de Angular para no repintar en cada movimiento) ----------

  private moverAvisoHover(id: number | null, x: number, y: number): void {
    const actual = this.hover?.AppointmentID ?? null;
    if (id !== actual) {
      this.zone.run(() => (this.hover = id === null ? null : this.coches.find((c) => c.AppointmentID === id) || null));
    }
    const el = this.tooltip?.nativeElement;
    if (el && id !== null) {
      const r = this.visorWrap.nativeElement.getBoundingClientRect();
      el.style.transform = `translate(${Math.min(x - r.left + 14, r.width - 230)}px, ${y - r.top + 14}px)`;
    }
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

  /** Matrículas para el buscador (en el taller y por colocar). */
  get matriculas(): string[] {
    return [...this.coches, ...this.pendientes].map((c) => (c.Matricula || '').toUpperCase());
  }

  /** Busca un coche por matrícula: lo enfoca y abre su ficha. */
  buscarMatricula(): void {
    const q = this.busqueda.replace(/[\s-]/g, '').toUpperCase();
    if (!q) return;
    const coincide = (m: string) => (m || '').replace(/[\s-]/g, '').toUpperCase().includes(q);
    const enTaller = this.coches.find((c) => coincide(c.Matricula));
    if (enTaller) {
      if (this.editando) this.descartarEdicion();
      this.abrirDesdeLista(enTaller.AppointmentID);
      this.busqueda = '';
      return;
    }
    const pendiente = this.pendientes.find((c) => coincide(c.Matricula));
    if (pendiente) {
      this.mostrarAviso(`${pendiente.Matricula.toUpperCase()} tiene cita hoy a las ${this.hora(pendiente.StartDateTime)} y está por colocar`);
      this.seleccionarCoche(pendiente.AppointmentID);
      this.busqueda = '';
      return;
    }
    this.mostrarAviso(`No hay ningún coche con la matrícula «${this.busqueda}» este día`, true);
  }

  /** Puestos ocupados / total, para el resumen. */
  get ocupacion(): { ocupados: number; total: number; porcentaje: number } {
    const total = this.layout?.puestos.length || 0;
    const ocupados = this.coches.length;
    return { ocupados, total, porcentaje: total ? Math.round((ocupados / total) * 100) : 0 };
  }

  get numRetrasos(): number {
    return this.coches.filter((c) => cocheConRetraso(c)).length;
  }

  conRetraso(c: { EndDateTime?: string; Status: string }): boolean {
    return cocheConRetraso(c);
  }

  alternarPantallaCompleta(): void {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      this.visorWrap.nativeElement.requestFullscreen?.().catch(() => this.mostrarAviso('El navegador no permite la pantalla completa', true));
    }
  }

  alternarGiro(): void {
    this.girando = !this.girando;
    this.escena?.setAutoRotate(this.girando);
  }

  // ---------- Filtro por estado (leyenda) ----------

  alternarEstado(estado: string): void {
    if (this.estadosOcultos.has(estado)) this.estadosOcultos.delete(estado);
    else this.estadosOcultos.add(estado);
    const visibles = ['Pendiente', 'Confirmada', 'Finalizada', 'Cancelada'].filter((e) => !this.estadosOcultos.has(e));
    this.escena?.setFiltroEstados(this.estadosOcultos.size ? visibles : null);
  }

  // ---------- Captura de la vista ----------

  descargarCaptura(): void {
    const url = this.escena?.captura();
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `taller-${this.fecha}.png`;
    a.click();
  }

  // ---------- Recordar la cámara entre visitas ----------

  private guardarCamara = (): void => {
    const c = this.escena?.getCamara();
    if (!c || !this.camaraRestaurada) return;
    try { localStorage.setItem(this.CLAVE_CAMARA, JSON.stringify(c)); } catch { /* sin almacenamiento */ }
  };

  private restaurarCamara(): void {
    if (this.camaraRestaurada) return;
    this.camaraRestaurada = true;
    try {
      const c: EstadoCamara = JSON.parse(localStorage.getItem(this.CLAVE_CAMARA) || 'null');
      if (c && Array.isArray(c.pos) && Array.isArray(c.target)) this.escena?.setCamara(c);
    } catch { /* sin almacenamiento o dato corrupto */ }
  }

  // ---------- Tiempo de cada cita ----------

  /** «Empieza en 20 min», «Faltan 45 min», «Retraso de 1 h 10 min»... */
  tiempoCita(c: { StartDateTime: string; EndDateTime: string; Status: string }): string {
    if (c.Status === 'Finalizada') return 'Terminada';
    if (c.Status === 'Cancelada') return '';
    const ahora = Date.now();
    const ini = new Date(c.StartDateTime.replace(' ', 'T')).getTime();
    const fin = new Date(c.EndDateTime.replace(' ', 'T')).getTime();
    if (ahora < ini) return `Empieza en ${this.duracion(ini - ahora)}`;
    if (ahora <= fin) return `Faltan ${this.duracion(fin - ahora)}`;
    return `Retraso de ${this.duracion(ahora - fin)}`;
  }

  private duracion(ms: number): string {
    const min = Math.max(1, Math.round(ms / 60000));
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    if (h >= 24) return `${Math.floor(h / 24)} d`;
    const m = min % 60;
    return m ? `${h} h ${m} min` : `${h} h`;
  }

  // ---------- Atajos de teclado ----------

  @HostListener('document:keydown', ['$event'])
  atajo(ev: KeyboardEvent): void {
    const t = ev.target as HTMLElement | null;
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return;
    const k = ev.key.toLowerCase();
    if (k === 'escape') {
      if (this.verAtajos) this.verAtajos = false;
      else if (this.cocheSel) this.cerrarFicha();
      return;
    }
    if (this.editando) return;
    const acciones: { [tecla: string]: () => void } = {
      '/': () => this.buscador?.nativeElement.focus(),
      '?': () => (this.verAtajos = !this.verAtajos),
      f: () => this.alternarPantallaCompleta(),
      g: () => this.alternarGiro(),
      i: () => this.vistaInicial(),
      p: () => this.vistaPlanta(),
      c: () => this.descargarCaptura(),
      e: () => this.esElevable && this.alternarElevador(),
    };
    const accion = acciones[k] || acciones[ev.key];
    if (accion) {
      ev.preventDefault();
      accion();
    }
  }

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
