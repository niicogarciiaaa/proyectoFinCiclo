import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/**
 * Escena 3D del taller (Three.js), independiente de Angular.
 *
 * Construye el taller a partir de una «distribución» (planta y puestos:
 * elevadores, foso, plazas, lavado) con un estilo minimalista y coloca en
 * cada puesto el coche que lo ocupa. Todo se genera por código (sin modelos
 * externos). Notifica por callbacks los clics en coches y puestos y,
 * en modo edición, el arrastre de puestos por el suelo.
 */

export type TipoPuesto = 'elevador2' | 'elevador4' | 'foso' | 'plaza' | 'lavado';

export interface Puesto {
  key: string;
  tipo: TipoPuesto;
  etiqueta: string;
  x: number;
  z: number;
  rot: number;
  color?: string;
}

export interface Distribucion {
  version: number;
  nombre: string;
  ancho: number;
  fondo: number;
  colorSuelo: string;
  colorParedes: string;
  colorElevadores: string;
  colorLineas: string;
  puestos: Puesto[];
}

export interface CocheEnTaller {
  AppointmentID: number;
  BayKey: string;
  CarColor: string;
  Lifted: boolean;
  Marca: string;
  Modelo: string;
  Matricula: string;
  Status: string;
  Service: string;
  /** Si llega, se usa para avisar de retraso (fin pasado y sin finalizar). */
  EndDateTime?: string;
}

export interface GarageSceneCallbacks {
  onSelectCar: (appointmentId: number | null) => void;
  onSelectBay: (key: string | null) => void;
  onBayMoved: (key: string, x: number, z: number) => void;
  /** Se ha soltado un coche arrastrado: puesto de destino (o null si fuera). */
  onCarDropped?: (appointmentId: number, bayKey: string | null) => void;
  /** El ratón pasa por encima de un coche (null al salir). */
  onHoverCar?: (appointmentId: number | null, clientX: number, clientY: number) => void;
  /** Doble clic sobre un coche (p. ej. subir o bajar el elevador). */
  onDoubleClickCar?: (appointmentId: number) => void;
}

/** Posición de la cámara, para recordarla entre visitas. */
export interface EstadoCamara {
  pos: [number, number, number];
  target: [number, number, number];
}

/** La cita debería haber terminado ya y no está finalizada. */
export function cocheConRetraso(c: { EndDateTime?: string; Status: string }, ahora = new Date()): boolean {
  if (!c.EndDateTime || c.Status === 'Finalizada' || c.Status === 'Cancelada') return false;
  return new Date(c.EndDateTime.replace(' ', 'T')) < ahora;
}

/** Medidas de un puesto (metros): ancho en X local y largo en Z local. */
const PUESTO_ANCHO = 3.4;
const PUESTO_LARGO = 5.8;
/** Altura a la que sube un elevador. */
const ALTURA_ELEVADO = 1.8;

const COLOR_ESTADO: { [estado: string]: string } = {
  Pendiente: '#f59e0b',
  Confirmada: '#3b82f6',
  Finalizada: '#10b981',
  Cancelada: '#ef4444',
};

/**
 * Paleta del estilo minimalista: fondo y suelo casi blancos, líneas grises
 * finas y equipos blancos; el único color fuerte es el de acento de la
 * distribución (colorElevadores) y el de cada coche.
 */
const PALETA = {
  fondo: '#f1f3f5',
  suelo: '#fafbfc',
  borde: '#dfe3e8',
  linea: '#d0d5dc',
  equipo: '#ffffff',
  metal: '#cfd4db',
  oscuro: '#3a4049',
  texto: '#8a94a3',
  agua: '#e6f2fb',
  cristal: '#2d333b',
  rueda: '#2a2e35',
};
const FUENTE = '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif';

/** Tipos de puesto en los que el coche puede subir. */
export const PUESTOS_ELEVABLES: TipoPuesto[] = ['elevador2', 'elevador4'];

interface PuestoObj {
  datos: Puesto;
  grupo: THREE.Group;
  /** Parte móvil (carro del elevador): el coche va encima. */
  elevable: THREE.Group;
  seleccion: THREE.Object3D;
}

interface CocheObj {
  datos: CocheEnTaller;
  grupo: THREE.Group;
  carroceria: THREE.MeshStandardMaterial;
  anillo: THREE.Mesh;
}

export class GarageScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private raycaster = new THREE.Raycaster();
  private puntero = new THREE.Vector2();
  private planoSuelo = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  private estatico = new THREE.Group();
  private puestos = new Map<string, PuestoObj>();
  private coches = new Map<number, CocheObj>();
  private layout: Distribucion | null = null;
  private listaCoches: CocheEnTaller[] = [];

  private modoEdicion = false;
  private cocheSeleccionado: number | null = null;
  private puestoSeleccionado: string | null = null;
  private arrastrando: { key: string; offset: THREE.Vector3 } | null = null;
  /** Coche pulsado en modo vista (se convierte en arrastre al moverlo). */
  private cogido: { id: number; arrastrando: boolean } | null = null;
  private puestoResaltado: string | null = null;
  /** Mostrar con un contorno tenue todos los puestos libres (al arrastrar). */
  private verLibres = false;
  /** Estados visibles; null = todos. Los demás coches se atenúan. */
  private filtroEstados: Set<string> | null = null;
  private hoverCoche: number | null = null;
  private pulsadoEn = new THREE.Vector2();

  private frame = 0;
  private resizeObserver: ResizeObserver;
  private reloj = new THREE.Clock();
  private sol = new THREE.DirectionalLight('#ffffff', 1.9);

  constructor(private contenedor: HTMLElement, private callbacks: GarageSceneCallbacks) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.touchAction = 'none';
    contenedor.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(PALETA.fondo);
    // Niebla suave: el suelo se funde con el fondo, sin horizonte marcado
    this.scene.fog = new THREE.Fog(PALETA.fondo, 45, 110);
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 500);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI / 2.15; // no bajar del suelo
    this.controls.minDistance = 4;
    this.controls.maxDistance = 120;

    // Luz ambiente clara y una luz principal con sombras muy suaves
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#d5dbe3', 1.7));
    this.sol.position.set(-8, 26, 14);
    this.sol.castShadow = true;
    this.sol.shadow.mapSize.set(2048, 2048);
    this.sol.shadow.bias = -0.0004;
    this.sol.shadow.normalBias = 0.02;
    this.sol.shadow.radius = 6;
    this.scene.add(this.sol);
    this.scene.add(this.sol.target);
    this.scene.add(this.estatico);

    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', this.onPointerDown);
    el.addEventListener('pointermove', this.onPointerMove);
    el.addEventListener('pointerup', this.onPointerUp);
    el.addEventListener('pointerleave', this.onPointerUp);
    el.addEventListener('dblclick', this.onDoubleClick);

    this.resizeObserver = new ResizeObserver(() => this.ajustarTamano());
    this.resizeObserver.observe(contenedor);
    this.ajustarTamano();
    this.animar();
  }

  // =================================================================
  //  API pública
  // =================================================================

  /** (Re)construye el taller con una distribución nueva. */
  setLayout(layout: Distribucion, recolocarCamara = false): void {
    const primeraVez = !this.layout;
    this.layout = layout;
    this.limpiarGrupo(this.estatico);
    this.puestos.clear();
    this.coches.clear();

    this.construirNave(layout);
    for (const p of layout.puestos) {
      this.construirPuesto(p, layout);
    }
    this.colocarCoches(this.listaCoches);
    this.aplicarSeleccion();
    if (primeraVez || recolocarCamara) {
      this.vistaInicial();
    }
  }

  /** Coloca los coches en sus puestos. */
  setCars(coches: CocheEnTaller[]): void {
    this.listaCoches = coches;
    this.colocarCoches(coches);
    this.aplicarSeleccion();
  }

  setEditMode(activo: boolean): void {
    this.modoEdicion = activo;
    this.aplicarSeleccion();
  }

  selectCar(id: number | null): void {
    this.cocheSeleccionado = id;
    this.aplicarSeleccion();
  }

  selectBay(key: string | null): void {
    this.puestoSeleccionado = key;
    this.aplicarSeleccion();
  }

  /** Centra la cámara en un coche. */
  enfocarCoche(id: number): void {
    const c = this.coches.get(id);
    if (!c) return;
    const pos = new THREE.Vector3();
    c.grupo.getWorldPosition(pos);
    this.controls.target.copy(pos);
    this.camera.position.set(pos.x + 6, pos.y + 5, pos.z + 8);
  }

  /** Puesto que hay bajo un punto de la pantalla (o null). */
  puestoEn(clientX: number, clientY: number): string | null {
    const pick = this.pickEn({ clientX, clientY });
    return pick?.key ?? null;
  }

  /** Resalta un puesto (destino de un arrastre); null para quitarlo. */
  resaltarPuesto(key: string | null): void {
    if (key === this.puestoResaltado) return;
    this.puestoResaltado = key;
    this.aplicarSeleccion();
  }

  /** Resalta (o deja de resaltar) todos los puestos libres. */
  mostrarLibres(activo: boolean): void {
    this.verLibres = activo;
    this.aplicarSeleccion();
  }

  /** Atenúa los coches cuyo estado no está en la lista (null = ver todos). */
  setFiltroEstados(estados: string[] | null): void {
    this.filtroEstados = estados ? new Set(estados) : null;
    this.aplicarSeleccion();
  }

  /** Imagen PNG de la vista actual (data URL). */
  captura(): string {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }

  getCamara(): EstadoCamara {
    const p = this.camera.position;
    const t = this.controls.target;
    return { pos: [p.x, p.y, p.z], target: [t.x, t.y, t.z] };
  }

  setCamara(c: EstadoCamara): void {
    this.camera.position.set(...c.pos);
    this.controls.target.set(...c.target);
    this.controls.update();
  }

  /** Giro automático lento de la cámara (modo presentación). */
  setAutoRotate(activo: boolean): void {
    this.controls.autoRotate = activo;
    this.controls.autoRotateSpeed = 0.6;
  }

  vistaInicial(): void {
    const l = this.layout;
    const tam = l ? Math.max(l.ancho, l.fondo) : 26;
    this.controls.target.set(0, 0, 0);
    this.camera.position.set(tam * 0.3, tam * 0.8, tam * 0.95);
  }

  vistaPlanta(): void {
    const l = this.layout;
    const tam = l ? Math.max(l.ancho, l.fondo) : 26;
    this.controls.target.set(0, 0, 0);
    this.camera.position.set(0, tam * 1.9, 0.01);
  }

  dispose(): void {
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    const el = this.renderer.domElement;
    el.removeEventListener('pointerdown', this.onPointerDown);
    el.removeEventListener('pointermove', this.onPointerMove);
    el.removeEventListener('pointerup', this.onPointerUp);
    el.removeEventListener('pointerleave', this.onPointerUp);
    el.removeEventListener('dblclick', this.onDoubleClick);
    this.controls.dispose();
    this.limpiarGrupo(this.estatico);
    this.renderer.dispose();
    el.remove();
  }

  // =================================================================
  //  Construcción del taller
  // =================================================================

  private construirNave(l: Distribucion): void {
    // Suelo infinito (se pierde en la niebla) que solo recoge sombras
    const exterior = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      new THREE.MeshStandardMaterial({ color: PALETA.fondo, roughness: 1 })
    );
    exterior.rotation.x = -Math.PI / 2;
    exterior.position.y = -0.01;
    exterior.receiveShadow = true;
    this.estatico.add(exterior);

    // Planta del taller: una losa clara con las esquinas redondeadas
    const losa = new THREE.Mesh(
      new THREE.ShapeGeometry(this.formaRedondeada(l.ancho, l.fondo, 0.8), 12),
      new THREE.MeshStandardMaterial({ color: PALETA.suelo, roughness: 0.95 })
    );
    losa.rotation.x = -Math.PI / 2;
    losa.receiveShadow = true;
    this.estatico.add(losa);
    this.estatico.add(this.contorno(l.ancho, l.fondo, 0.8, 0.06, PALETA.borde, 0.002));

    // Nombre del taller, discreto, pintado en el suelo junto al borde del fondo
    if (l.nombre) {
      const tex = this.texturaTexto(l.nombre.toUpperCase(), { color: PALETA.texto, ancho: 1024, alto: 96, tam: 54, peso: 600, espaciado: 6 });
      const ancho = Math.min(l.ancho * 0.5, 11);
      const rotulo = new THREE.Mesh(
        new THREE.PlaneGeometry(ancho, ancho * (96 / 1024)),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
      );
      rotulo.rotation.x = -Math.PI / 2;
      rotulo.position.set(0, 0.003, -l.fondo / 2 - 0.9);
      this.estatico.add(rotulo);
    }

    // La sombra cubre todo el taller
    const cam = this.sol.shadow.camera;
    const r = Math.max(l.ancho, l.fondo) * 0.75;
    cam.left = -r; cam.right = r; cam.top = r; cam.bottom = -r;
    cam.near = 1; cam.far = 80;
    cam.updateProjectionMatrix();
  }

  private construirPuesto(p: Puesto, l: Distribucion): void {
    const grupo = new THREE.Group();
    grupo.position.set(p.x, 0, p.z);
    grupo.rotation.y = -THREE.MathUtils.degToRad(p.rot);
    grupo.userData = { pick: { tipo: 'puesto', key: p.key } };

    const elevable = new THREE.Group();
    grupo.add(elevable);

    const acento = new THREE.MeshStandardMaterial({ color: p.color || l.colorElevadores, roughness: 0.5 });
    const equipo = new THREE.MeshStandardMaterial({ color: PALETA.equipo, roughness: 0.55 });
    const metal = new THREE.MeshStandardMaterial({ color: PALETA.metal, roughness: 0.5, metalness: 0.1 });

    // Contorno fino del puesto (y un fondo tenue en el lavado)
    if (p.tipo === 'lavado') {
      const fondo = new THREE.Mesh(
        new THREE.ShapeGeometry(this.formaRedondeada(PUESTO_ANCHO, PUESTO_LARGO, 0.35), 8),
        new THREE.MeshStandardMaterial({ color: PALETA.agua, roughness: 1 })
      );
      fondo.rotation.x = -Math.PI / 2;
      fondo.position.y = 0.003;
      fondo.receiveShadow = true;
      grupo.add(fondo);
    }
    grupo.add(this.contorno(PUESTO_ANCHO, PUESTO_LARGO, 0.35, 0.05, PALETA.linea, 0.004));

    switch (p.tipo) {
      case 'elevador2': {
        // Dos columnas finas con un remate de color y brazos bajo el coche
        for (const lado of [-1, 1]) {
          const x = lado * (PUESTO_ANCHO / 2 - 0.2);
          const columna = this.caja(0.26, 3.2, 0.34, equipo, 0.08);
          columna.position.set(x, 1.6, 0);
          grupo.add(columna);
          const remate = this.caja(0.27, 0.12, 0.35, acento, 0.05);
          remate.position.set(x, 3.16, 0);
          grupo.add(remate);
          const carro = this.caja(0.3, 0.36, 0.42, acento, 0.06);
          carro.position.set(x, 0.3, 0);
          elevable.add(carro);
          for (const sentido of [-1, 1]) {
            const brazo = this.caja(1.1, 0.07, 0.12, metal, 0.03);
            brazo.position.set(lado * (PUESTO_ANCHO / 2 - 0.85), 0.14, sentido * 0.85);
            brazo.rotation.y = sentido * lado * 0.3;
            elevable.add(brazo);
          }
        }
        break;
      }
      case 'elevador4': {
        // Cuatro postes finos y dos rampas que suben con el coche
        for (const lx of [-1, 1]) {
          for (const lz of [-1, 1]) {
            const poste = this.caja(0.22, 2.4, 0.22, equipo, 0.06);
            poste.position.set(lx * (PUESTO_ANCHO / 2 - 0.15), 1.2, lz * (PUESTO_LARGO / 2 - 0.3));
            grupo.add(poste);
            const remate = this.caja(0.23, 0.1, 0.23, acento, 0.04);
            remate.position.set(lx * (PUESTO_ANCHO / 2 - 0.15), 2.38, lz * (PUESTO_LARGO / 2 - 0.3));
            grupo.add(remate);
          }
          const rampa = this.caja(0.6, 0.1, PUESTO_LARGO - 0.6, metal, 0.04);
          rampa.position.set(lx * 0.78, 0.12, 0);
          elevable.add(rampa);
        }
        elevable.userData['baseCoche'] = 0.17; // el coche apoya sobre las rampas
        break;
      }
      case 'foso': {
        // Ranura oscura con las esquinas redondeadas
        const hueco = new THREE.Mesh(
          new THREE.ShapeGeometry(this.formaRedondeada(0.95, PUESTO_LARGO - 0.9, 0.2), 6),
          new THREE.MeshStandardMaterial({ color: PALETA.oscuro, roughness: 1 })
        );
        hueco.rotation.x = -Math.PI / 2;
        hueco.position.y = 0.005;
        grupo.add(hueco);
        break;
      }
      case 'lavado': {
        // Arco fino
        for (const lado of [-1, 1]) {
          const pilar = this.caja(0.2, 2.8, 0.3, equipo, 0.06);
          pilar.position.set(lado * (PUESTO_ANCHO / 2 - 0.15), 1.4, -1.3);
          grupo.add(pilar);
        }
        const viga = this.caja(PUESTO_ANCHO - 0.1, 0.18, 0.3, equipo, 0.06);
        viga.position.set(0, 2.8, -1.3);
        grupo.add(viga);
        const franja = this.caja(PUESTO_ANCHO - 0.4, 0.06, 0.31, acento, 0.02);
        franja.position.set(0, 2.66, -1.3);
        grupo.add(franja);
        break;
      }
      case 'plaza':
      default:
        break;
    }

    // Nombre del puesto en el suelo, en gris y sin adornos
    if (p.etiqueta) {
      const tex = this.texturaTexto(p.etiqueta, { color: '#6b7584', ancho: 512, alto: 96, tam: 50, peso: 600 });
      const rotulo = new THREE.Mesh(
        new THREE.PlaneGeometry(3, 3 * (96 / 512)),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
      );
      rotulo.rotation.x = -Math.PI / 2;
      rotulo.position.set(0, 0.006, PUESTO_LARGO / 2 + 0.5);
      grupo.add(rotulo);
    }

    // Contorno de selección (modo edición), con el color de acento
    const seleccion = this.contorno(PUESTO_ANCHO + 0.4, PUESTO_LARGO + 1.3, 0.5, 0.09, p.color || l.colorElevadores, 0.008);
    seleccion.position.z = 0.3;
    seleccion.visible = false;
    grupo.add(seleccion);

    // Zona invisible para poder pinchar el puesto aunque no tenga estructura
    const zona = new THREE.Mesh(
      new THREE.BoxGeometry(PUESTO_ANCHO, 0.1, PUESTO_LARGO),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    zona.position.y = 0.05;
    grupo.add(zona);

    grupo.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && o !== zona && (o as THREE.Mesh).geometry.type !== 'ShapeGeometry') {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });

    this.estatico.add(grupo);
    this.puestos.set(p.key, { datos: p, grupo, elevable, seleccion });
  }

  // =================================================================
  //  Coches
  // =================================================================

  private colocarCoches(lista: CocheEnTaller[]): void {
    // Quitar los coches actuales
    for (const c of this.coches.values()) {
      c.grupo.parent?.remove(c.grupo);
      this.liberar(c.grupo);
    }
    this.coches.clear();

    for (const datos of lista) {
      const puesto = this.puestos.get(datos.BayKey);
      if (!puesto) continue;
      const coche = this.crearCoche(datos);
      coche.grupo.position.y = puesto.elevable.userData['baseCoche'] ?? 0;
      puesto.elevable.add(coche.grupo);
      // Arrancar ya en la altura correcta, sin animación
      puesto.elevable.position.y = this.alturaObjetivo(puesto);
      this.coches.set(datos.AppointmentID, coche);
    }
    // Puestos vacíos: elevador abajo
    for (const p of this.puestos.values()) {
      p.elevable.position.y = this.alturaObjetivo(p);
    }
  }

  private crearCoche(datos: CocheEnTaller): CocheObj {
    const grupo = new THREE.Group();
    grupo.userData = { pick: { tipo: 'coche', id: datos.AppointmentID } };

    // Coche simplificado de bordes redondeados, de un solo color mate
    const carroceria = new THREE.MeshStandardMaterial({
      color: datos.CarColor || '#3b82f6', roughness: 0.5, metalness: 0.05,
    });
    const cristal = new THREE.MeshStandardMaterial({ color: PALETA.cristal, roughness: 0.3 });
    const rueda = new THREE.MeshStandardMaterial({ color: PALETA.rueda, roughness: 0.9 });

    const cuerpo = this.caja(1.8, 0.62, 4.2, carroceria, 0.22);
    cuerpo.position.y = 0.66;
    grupo.add(cuerpo);
    const cabina = this.caja(1.56, 0.56, 2.15, cristal, 0.22);
    cabina.position.set(0, 1.16, -0.2);
    grupo.add(cabina);
    const techo = this.caja(1.5, 0.12, 1.8, carroceria, 0.06);
    techo.position.set(0, 1.42, -0.22);
    grupo.add(techo);
    for (const x of [-0.84, 0.84]) {
      for (const z of [-1.35, 1.35]) {
        const r = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 24), rueda);
        r.rotation.z = Math.PI / 2;
        r.position.set(x, 0.34, z);
        grupo.add(r);
      }
    }
    grupo.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });

    // Contorno en el suelo: solo se ve al seleccionar el coche
    const anillo = new THREE.Mesh(
      new THREE.ShapeGeometry(this.formaAnillo(2.5, 4.9, 0.6, 0.09), 10),
      new THREE.MeshBasicMaterial({ color: COLOR_ESTADO[datos.Status] || '#94a3b8', transparent: true, opacity: 0.9, depthWrite: false })
    );
    anillo.rotation.x = -Math.PI / 2;
    anillo.position.y = 0.012;
    anillo.visible = false;
    grupo.add(anillo);

    // Etiqueta flotante: punto del estado, matrícula y modelo
    const cartel = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.texturaEtiquetaCoche(datos),
      depthTest: false,
      transparent: true,
    }));
    cartel.scale.set(2.6, 0.81, 1);
    cartel.position.set(0, 2.25, 0);
    cartel.renderOrder = 10;
    grupo.add(cartel);

    return { datos, grupo, carroceria, anillo };
  }

  private alturaObjetivo(p: PuestoObj): number {
    if (!PUESTOS_ELEVABLES.includes(p.datos.tipo)) return 0;
    const coche = [...this.coches.values()].find((c) => c.datos.BayKey === p.datos.key);
    return coche && coche.datos.Lifted ? ALTURA_ELEVADO : 0;
  }

  /** Aplica resaltes de selección a coches y puestos. */
  private aplicarSeleccion(): void {
    for (const [id, c] of this.coches) {
      const sel = id === this.cocheSeleccionado;
      c.anillo.visible = sel;
      c.carroceria.emissive.set(sel ? '#ffffff' : '#000000');
      c.carroceria.emissiveIntensity = sel ? 0.08 : 0;
      this.atenuar(c, !sel && !!this.filtroEstados && !this.filtroEstados.has(c.datos.Status));
    }
    const ocupados = new Set([...this.coches.values()]
      .filter((c) => c.datos.AppointmentID !== this.cogido?.id)
      .map((c) => c.datos.BayKey));
    for (const [key, p] of this.puestos) {
      const fuerte = (this.modoEdicion && key === this.puestoSeleccionado) || key === this.puestoResaltado;
      const libre = this.verLibres && !ocupados.has(key);
      p.seleccion.visible = fuerte || libre;
      const mat = (p.seleccion as THREE.Mesh).material as THREE.MeshBasicMaterial;
      mat.transparent = true;
      mat.opacity = fuerte ? 1 : 0.35;
    }
  }

  /** Vuelve casi transparente un coche (filtro por estado) o lo restaura. */
  private atenuar(c: CocheObj, si: boolean): void {
    if (c.grupo.userData['atenuado'] === si) return;
    c.grupo.userData['atenuado'] = si;
    c.grupo.traverse((o) => {
      const m = o as THREE.Mesh | THREE.Sprite;
      const mat = (m as any).material as THREE.Material | undefined;
      if (!mat || o === c.anillo) return;
      if (mat.userData['opacidad'] === undefined) {
        mat.userData['opacidad'] = mat.opacity;
        mat.userData['transparente'] = mat.transparent;
      }
      mat.transparent = si || mat.userData['transparente'];
      mat.opacity = si ? 0.12 : mat.userData['opacidad'];
      mat.depthWrite = !si;
      mat.needsUpdate = true;
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = !si;
    });
  }

  // =================================================================
  //  Interacción
  // =================================================================

  private onPointerDown = (ev: PointerEvent): void => {
    this.pulsadoEn.set(ev.clientX, ev.clientY);
    if (!this.modoEdicion) {
      // Pulsar un coche: si luego se mueve el ratón, se arrastra a otro puesto.
      const pick = ev.button === 0 ? this.pickEn(ev) : null;
      if (pick?.tipo === 'coche' && pick.id !== undefined) {
        this.cogido = { id: pick.id, arrastrando: false };
        this.controls.enabled = false;
        this.renderer.domElement.setPointerCapture(ev.pointerId);
      }
      return;
    }
    const pick = this.pickEn(ev);
    if (pick?.tipo === 'puesto' || (pick?.tipo === 'coche' && pick.key)) {
      const key = pick.key as string;
      const p = this.puestos.get(key);
      const punto = this.puntoSuelo(ev);
      if (p && punto) {
        this.arrastrando = { key, offset: p.grupo.position.clone().sub(punto) };
        this.controls.enabled = false;
        this.renderer.domElement.setPointerCapture(ev.pointerId);
        this.puestoSeleccionado = key;
        this.callbacks.onSelectBay(key);
        this.aplicarSeleccion();
      }
    }
  };

  private onPointerMove = (ev: PointerEvent): void => {
    if (this.cogido) {
      const movido = Math.hypot(ev.clientX - this.pulsadoEn.x, ev.clientY - this.pulsadoEn.y);
      const coche = this.coches.get(this.cogido.id);
      if (coche && (this.cogido.arrastrando || movido > 6)) {
        if (!this.cogido.arrastrando) {
          this.cogido.arrastrando = true;
          this.verLibres = true;
          this.estatico.attach(coche.grupo); // sale del puesto sin saltar
          this.avisarHover(null, ev);
        }
        const punto = this.puntoSuelo(ev);
        if (punto) coche.grupo.position.set(punto.x, 0.35, punto.z);
        this.renderer.domElement.style.cursor = 'grabbing';
        this.resaltarPuesto(this.puestoBajo(ev, coche.grupo));
      }
      return;
    }
    if (this.arrastrando && this.layout) {
      const punto = this.puntoSuelo(ev);
      const p = this.puestos.get(this.arrastrando.key);
      if (punto && p) {
        const destino = punto.add(this.arrastrando.offset);
        // Ajuste a una cuadrícula de 0,25 m y dentro de las paredes
        const ax = this.layout.ancho / 2;
        const az = this.layout.fondo / 2;
        p.grupo.position.x = THREE.MathUtils.clamp(Math.round(destino.x * 4) / 4, -ax, ax);
        p.grupo.position.z = THREE.MathUtils.clamp(Math.round(destino.z * 4) / 4, -az, az);
      }
      return;
    }
    // Cursor de mano al pasar por encima de algo pinchable
    const pick = this.pickEn(ev);
    const pinchable = pick && (pick.tipo === 'coche' || this.modoEdicion);
    this.renderer.domElement.style.cursor = pinchable ? 'pointer' : 'grab';
    this.avisarHover(!this.modoEdicion && pick?.tipo === 'coche' ? pick.id ?? null : null, ev);
  };

  private onPointerUp = (ev: PointerEvent): void => {
    if (ev.type === 'pointerleave') this.avisarHover(null, ev);
    if (this.cogido) {
      const { id, arrastrando } = this.cogido;
      this.cogido = null;
      this.controls.enabled = true;
      if (this.renderer.domElement.hasPointerCapture(ev.pointerId)) {
        this.renderer.domElement.releasePointerCapture(ev.pointerId);
      }
      if (arrastrando) {
        const coche = this.coches.get(id);
        const destino = coche ? this.puestoBajo(ev, coche.grupo) : null;
        this.verLibres = false;
        this.resaltarPuesto(null);
        // Vuelve a su sitio; si el cambio se guarda, la vista se refresca con setCars.
        this.colocarCoches(this.listaCoches);
        this.aplicarSeleccion();
        if (ev.type === 'pointerup') this.callbacks.onCarDropped?.(id, destino);
        return;
      }
      // Sin movimiento: es un clic normal y sigue abajo (selecciona el coche).
    }
    if (this.arrastrando) {
      const p = this.puestos.get(this.arrastrando.key);
      if (p) {
        p.datos.x = p.grupo.position.x;
        p.datos.z = p.grupo.position.z;
        this.callbacks.onBayMoved(p.datos.key, p.datos.x, p.datos.z);
      }
      this.arrastrando = null;
      this.controls.enabled = true;
      if (this.renderer.domElement.hasPointerCapture(ev.pointerId)) {
        this.renderer.domElement.releasePointerCapture(ev.pointerId);
      }
      return;
    }
    if (ev.type !== 'pointerup') return;
    // Un clic (no un arrastre de cámara) selecciona
    const movido = Math.hypot(ev.clientX - this.pulsadoEn.x, ev.clientY - this.pulsadoEn.y);
    if (movido > 5) return;
    const pick = this.pickEn(ev);
    if (this.modoEdicion) {
      const key = pick?.key ?? null;
      this.puestoSeleccionado = key;
      this.callbacks.onSelectBay(key);
    } else {
      const id = pick?.tipo === 'coche' ? (pick.id as number) : null;
      this.cocheSeleccionado = id;
      this.callbacks.onSelectCar(id);
    }
    this.aplicarSeleccion();
  };

  private onDoubleClick = (ev: MouseEvent): void => {
    if (this.modoEdicion) return;
    const pick = this.pickEn(ev);
    if (pick?.tipo === 'coche' && pick.id !== undefined) this.callbacks.onDoubleClickCar?.(pick.id);
  };

  /** Devuelve qué hay bajo el puntero: un coche (con su puesto) o un puesto. */
  private pickEn(ev: { clientX: number; clientY: number }, ignorar?: THREE.Object3D): { tipo: string; id?: number; key?: string } | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.puntero.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.puntero, this.camera);
    const hits = this.raycaster.intersectObjects(this.estatico.children, true);
    for (const hit of hits) {
      if (ignorar && this.esDescendiente(hit.object, ignorar)) continue;
      let o: THREE.Object3D | null = hit.object;
      let coche: number | undefined;
      while (o) {
        const pick = o.userData?.['pick'];
        if (pick?.tipo === 'coche' && coche === undefined) coche = pick.id;
        if (pick?.tipo === 'puesto') {
          return coche !== undefined ? { tipo: 'coche', id: coche, key: pick.key } : { tipo: 'puesto', key: pick.key };
        }
        o = o.parent;
      }
    }
    return null;
  }

  /** Puesto bajo el puntero ignorando el coche que se arrastra. */
  private puestoBajo(ev: { clientX: number; clientY: number }, coche: THREE.Object3D): string | null {
    return this.pickEn(ev, coche)?.key ?? null;
  }

  private esDescendiente(o: THREE.Object3D, padre: THREE.Object3D): boolean {
    for (let x: THREE.Object3D | null = o; x; x = x.parent) {
      if (x === padre) return true;
    }
    return false;
  }

  /** Avisa del coche bajo el ratón (solo cuando cambia, o para mover el aviso). */
  private avisarHover(id: number | null, ev: { clientX: number; clientY: number }): void {
    if (id === null && this.hoverCoche === null) return;
    this.hoverCoche = id;
    this.callbacks.onHoverCar?.(id, ev.clientX, ev.clientY);
  }

  private puntoSuelo(ev: PointerEvent): THREE.Vector3 | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.puntero.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.puntero, this.camera);
    const punto = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.planoSuelo, punto) ? punto : null;
  }

  // =================================================================
  //  Bucle de render
  // =================================================================

  private animar = (): void => {
    this.frame = requestAnimationFrame(this.animar);
    const dt = Math.min(this.reloj.getDelta(), 0.1);
    // Animación suave de los elevadores
    for (const p of this.puestos.values()) {
      const objetivo = this.alturaObjetivo(p);
      const actual = p.elevable.position.y;
      if (Math.abs(objetivo - actual) > 0.001) {
        p.elevable.position.y += (objetivo - actual) * Math.min(1, dt * 3);
      }
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  private ajustarTamano(): void {
    const w = this.contenedor.clientWidth || 1;
    const h = this.contenedor.clientHeight || 1;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // =================================================================
  //  Utilidades
  // =================================================================

  /** Caja con las aristas redondeadas (radio en metros). */
  private caja(w: number, h: number, d: number, mat: THREE.Material, radio = 0): THREE.Mesh {
    const r = Math.min(radio, w / 2, h / 2, d / 2) * 0.99;
    const geo = r > 0 ? new RoundedBoxGeometry(w, h, d, 3, r) : new THREE.BoxGeometry(w, h, d);
    return new THREE.Mesh(geo, mat);
  }

  /** Rectángulo de esquinas redondeadas centrado en el origen (plano XY). */
  private formaRedondeada(w: number, h: number, r: number): THREE.Shape {
    const s = new THREE.Shape();
    this.trazarRedondeado(s, w, h, r);
    return s;
  }

  /** Marco de esquinas redondeadas (rectángulo con hueco) de grosor `g`. */
  private formaAnillo(w: number, h: number, r: number, g: number): THREE.Shape {
    const s = this.formaRedondeada(w, h, r);
    const hueco = new THREE.Path();
    this.trazarRedondeado(hueco, w - g * 2, h - g * 2, Math.max(r - g, 0.01));
    s.holes.push(hueco);
    return s;
  }

  private trazarRedondeado(p: THREE.Path, w: number, h: number, r: number): void {
    const x = -w / 2, y = -h / 2;
    r = Math.min(r, w / 2, h / 2);
    p.moveTo(x + r, y);
    p.lineTo(x + w - r, y);
    p.quadraticCurveTo(x + w, y, x + w, y + r);
    p.lineTo(x + w, y + h - r);
    p.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    p.lineTo(x + r, y + h);
    p.quadraticCurveTo(x, y + h, x, y + h - r);
    p.lineTo(x, y + r);
    p.quadraticCurveTo(x, y, x + r, y);
  }

  /** Línea fina de contorno pintada en el suelo. */
  private contorno(w: number, h: number, r: number, g: number, color: string, y: number): THREE.Mesh {
    const m = new THREE.Mesh(
      new THREE.ShapeGeometry(this.formaAnillo(w, h, r, g), 10),
      new THREE.MeshBasicMaterial({ color, depthWrite: false })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.y = y;
    return m;
  }

  private texturaTexto(texto: string, o: { color: string; ancho: number; alto: number; tam: number; peso?: number; espaciado?: number }): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = o.ancho;
    canvas.height = o.alto;
    const ctx = canvas.getContext('2d')!;
    ctx.font = `${o.peso ?? 600} ${o.tam}px ${FUENTE}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (o.espaciado) (ctx as any).letterSpacing = `${o.espaciado}px`;
    ctx.fillStyle = o.color;
    ctx.fillText(texto, o.ancho / 2, o.alto / 2, o.ancho - 20);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }

  /** Etiqueta flotante: tarjeta blanca con punto de estado, matrícula y modelo. */
  private texturaEtiquetaCoche(d: CocheEnTaller): THREE.CanvasTexture {
    const W = 460, H = 144;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    // Sombra suave bajo la tarjeta
    ctx.shadowColor = 'rgba(15, 23, 42, 0.18)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = '#ffffff';
    this.rectRedondeado(ctx, 14, 10, W - 28, H - 32, 26);
    ctx.fill();
    ctx.shadowColor = 'transparent';

    const color = COLOR_ESTADO[d.Status] || '#94a3b8';
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(52, 48, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const retraso = cocheConRetraso(d);
    if (retraso) {
      // Aviso de retraso en la esquina: la cita ya debería haber terminado
      ctx.font = `700 22px ${FUENTE}`;
      const txt = 'RETRASO';
      const tw = ctx.measureText(txt).width + 22;
      ctx.fillStyle = '#fee2e2';
      this.rectRedondeado(ctx, W - 34 - tw, 31, tw, 34, 17);
      ctx.fill();
      ctx.fillStyle = '#b91c1c';
      ctx.fillText(txt, W - 34 - tw + 11, 49);
    }
    ctx.fillStyle = '#1f2937';
    ctx.font = `700 40px ${FUENTE}`;
    ctx.fillText((d.Matricula || '').toUpperCase(), 76, 50, retraso ? W - 250 : W - 110);
    ctx.fillStyle = '#8a94a3';
    ctx.font = `500 26px ${FUENTE}`;
    ctx.fillText(`${d.Marca} ${d.Modelo}`.trim(), 44, 88, W - 80);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }

  private rectRedondeado(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /** Libera geometrías, materiales y texturas de un objeto. */
  private liberar(obj: THREE.Object3D): void {
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      for (const mat of mats) {
        const conMapa = mat as THREE.MeshBasicMaterial;
        conMapa.map?.dispose();
        mat.dispose();
      }
    });
  }

  private limpiarGrupo(g: THREE.Group): void {
    for (const hijo of [...g.children]) {
      g.remove(hijo);
      this.liberar(hijo);
    }
  }
}
