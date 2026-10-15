import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * Escena 3D del taller (Three.js), independiente de Angular.
 *
 * Construye el taller a partir de una «distribución» (suelo, paredes,
 * cartel y puestos: elevadores, foso, plazas, lavado) y coloca en cada
 * puesto el coche que lo ocupa. Todo se genera por código (sin modelos
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
}

export interface GarageSceneCallbacks {
  onSelectCar: (appointmentId: number | null) => void;
  onSelectBay: (key: string | null) => void;
  onBayMoved: (key: string, x: number, z: number) => void;
}

/** Medidas de un puesto (metros): ancho en X local y largo en Z local. */
const PUESTO_ANCHO = 3.4;
const PUESTO_LARGO = 5.8;
const ALTURA_PAREDES = 4.5;
/** Altura a la que sube un elevador. */
const ALTURA_ELEVADO = 1.8;

const COLOR_ESTADO: { [estado: string]: string } = {
  Pendiente: '#fb8c00',
  Confirmada: '#1976d2',
  Finalizada: '#43a047',
  Cancelada: '#e53935',
};

/** Tipos de puesto en los que el coche puede subir. */
export const PUESTOS_ELEVABLES: TipoPuesto[] = ['elevador2', 'elevador4'];

interface PuestoObj {
  datos: Puesto;
  grupo: THREE.Group;
  /** Parte móvil (carro del elevador): el coche va encima. */
  elevable: THREE.Group;
  seleccion: THREE.LineSegments;
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
  private pulsadoEn = new THREE.Vector2();

  private frame = 0;
  private resizeObserver: ResizeObserver;
  private reloj = new THREE.Clock();

  constructor(private contenedor: HTMLElement, private callbacks: GarageSceneCallbacks) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.touchAction = 'none';
    contenedor.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color('#cfd8dc');
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI / 2.05; // no bajar del suelo
    this.controls.minDistance = 4;
    this.controls.maxDistance = 120;

    this.scene.add(new THREE.HemisphereLight('#ffffff', '#607d8b', 1.6));
    const sol = new THREE.DirectionalLight('#ffffff', 1.8);
    sol.position.set(12, 25, 14);
    sol.castShadow = true;
    sol.shadow.mapSize.set(2048, 2048);
    sol.shadow.bias = -0.0005;
    this.scene.add(sol);
    this.scene.add(sol.target);
    this.scene.add(this.estatico);

    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', this.onPointerDown);
    el.addEventListener('pointermove', this.onPointerMove);
    el.addEventListener('pointerup', this.onPointerUp);
    el.addEventListener('pointerleave', this.onPointerUp);

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

  vistaInicial(): void {
    const l = this.layout;
    const tam = l ? Math.max(l.ancho, l.fondo) : 26;
    this.controls.target.set(0, 0, 0);
    this.camera.position.set(tam * 0.15, tam * 0.75, tam * 0.95);
  }

  vistaPlanta(): void {
    const l = this.layout;
    const tam = l ? Math.max(l.ancho, l.fondo) : 26;
    this.controls.target.set(0, 0, 0);
    this.camera.position.set(0, tam * 1.35, 0.01);
  }

  dispose(): void {
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    const el = this.renderer.domElement;
    el.removeEventListener('pointerdown', this.onPointerDown);
    el.removeEventListener('pointermove', this.onPointerMove);
    el.removeEventListener('pointerup', this.onPointerUp);
    el.removeEventListener('pointerleave', this.onPointerUp);
    this.controls.dispose();
    this.limpiarGrupo(this.estatico);
    this.renderer.dispose();
    el.remove();
  }

  // =================================================================
  //  Construcción del taller
  // =================================================================

  private construirNave(l: Distribucion): void {
    // Suelo
    const suelo = new THREE.Mesh(
      new THREE.PlaneGeometry(l.ancho, l.fondo),
      new THREE.MeshStandardMaterial({ color: l.colorSuelo, roughness: 0.85 })
    );
    suelo.rotation.x = -Math.PI / 2;
    suelo.receiveShadow = true;
    this.estatico.add(suelo);

    // Rejilla sutil (baldosas de 2 m)
    const rejilla = new THREE.GridHelper(Math.max(l.ancho, l.fondo), Math.max(l.ancho, l.fondo) / 2, '#000000', '#000000');
    const matRejilla = rejilla.material as THREE.Material;
    matRejilla.transparent = true;
    matRejilla.opacity = 0.06;
    rejilla.position.y = 0.002;
    rejilla.scale.set(l.ancho / Math.max(l.ancho, l.fondo), 1, l.fondo / Math.max(l.ancho, l.fondo));
    this.estatico.add(rejilla);

    // Paredes: fondo y laterales (el frente queda abierto para ver dentro)
    const matPared = new THREE.MeshStandardMaterial({ color: l.colorParedes, roughness: 0.95 });
    const grosor = 0.25;
    const fondoPared = new THREE.Mesh(new THREE.BoxGeometry(l.ancho + grosor * 2, ALTURA_PAREDES, grosor), matPared);
    fondoPared.position.set(0, ALTURA_PAREDES / 2, -l.fondo / 2 - grosor / 2);
    fondoPared.receiveShadow = true;
    this.estatico.add(fondoPared);
    for (const lado of [-1, 1]) {
      const pared = new THREE.Mesh(new THREE.BoxGeometry(grosor, ALTURA_PAREDES, l.fondo), matPared);
      pared.position.set(lado * (l.ancho / 2 + grosor / 2), ALTURA_PAREDES / 2, 0);
      pared.receiveShadow = true;
      this.estatico.add(pared);
    }

    // Franja de color corporativo en la pared del fondo
    const franja = new THREE.Mesh(
      new THREE.BoxGeometry(l.ancho, 0.35, 0.05),
      new THREE.MeshStandardMaterial({ color: l.colorElevadores })
    );
    franja.position.set(0, 1.1, -l.fondo / 2 + 0.03);
    this.estatico.add(franja);

    // Cartel con el nombre del taller
    if (l.nombre) {
      const textura = this.texturaTexto(l.nombre, { fondo: '#263238', color: '#ffffff', ancho: 1024, alto: 160, tam: 92 });
      const anchoCartel = Math.min(l.ancho * 0.6, 14);
      const cartel = new THREE.Mesh(
        new THREE.PlaneGeometry(anchoCartel, anchoCartel * (160 / 1024)),
        new THREE.MeshBasicMaterial({ map: textura })
      );
      cartel.position.set(0, ALTURA_PAREDES - 0.9, -l.fondo / 2 + 0.04);
      this.estatico.add(cartel);
    }

    // Línea amarilla de seguridad en la entrada
    const entrada = new THREE.Mesh(
      new THREE.PlaneGeometry(l.ancho, 0.15),
      new THREE.MeshBasicMaterial({ color: l.colorLineas })
    );
    entrada.rotation.x = -Math.PI / 2;
    entrada.position.set(0, 0.004, l.fondo / 2 - 0.3);
    this.estatico.add(entrada);
  }

  private construirPuesto(p: Puesto, l: Distribucion): void {
    const grupo = new THREE.Group();
    grupo.position.set(p.x, 0, p.z);
    grupo.rotation.y = -THREE.MathUtils.degToRad(p.rot);
    grupo.userData = { pick: { tipo: 'puesto', key: p.key } };

    const elevable = new THREE.Group();
    grupo.add(elevable);

    const colorEstructura = p.color || l.colorElevadores;
    const matEstructura = new THREE.MeshStandardMaterial({ color: colorEstructura, metalness: 0.3, roughness: 0.5 });
    const matMetal = new THREE.MeshStandardMaterial({ color: '#90a4ae', metalness: 0.6, roughness: 0.4 });

    // Marcas en el suelo (todas los tipos)
    this.marcasSuelo(grupo, l.colorLineas, p.tipo === 'lavado' ? '#4fc3f7' : undefined);

    switch (p.tipo) {
      case 'elevador2': {
        // Dos columnas laterales con su carro y cuatro brazos bajo el coche
        for (const lado of [-1, 1]) {
          const columna = this.caja(0.35, 3.8, 0.45, matEstructura);
          columna.position.set(lado * (PUESTO_ANCHO / 2 - 0.15), 1.9, 0);
          grupo.add(columna);
          const base = this.caja(0.7, 0.08, 0.8, matEstructura);
          base.position.set(lado * (PUESTO_ANCHO / 2 - 0.15), 0.04, 0);
          grupo.add(base);
          const carro = this.caja(0.4, 0.5, 0.5, matMetal);
          carro.position.set(lado * (PUESTO_ANCHO / 2 - 0.15), 0.3, 0);
          elevable.add(carro);
          for (const sentido of [-1, 1]) {
            const brazo = this.caja(1.2, 0.08, 0.14, matMetal);
            brazo.position.set(lado * (PUESTO_ANCHO / 2 - 0.85), 0.12, sentido * 0.9);
            brazo.rotation.y = sentido * lado * 0.35;
            elevable.add(brazo);
            const taco = this.caja(0.22, 0.1, 0.22, new THREE.MeshStandardMaterial({ color: '#212121' }));
            taco.position.set(lado * 0.75, 0.2, sentido * 1.15);
            elevable.add(taco);
          }
        }
        // Travesaño superior
        const travesano = this.caja(PUESTO_ANCHO, 0.2, 0.3, matEstructura);
        travesano.position.set(0, 3.85, 0);
        grupo.add(travesano);
        break;
      }
      case 'elevador4': {
        // Cuatro columnas en las esquinas y dos rampas que suben con el coche
        for (const lx of [-1, 1]) {
          for (const lz of [-1, 1]) {
            const columna = this.caja(0.3, 2.8, 0.3, matEstructura);
            columna.position.set(lx * (PUESTO_ANCHO / 2 - 0.1), 1.4, lz * (PUESTO_LARGO / 2 - 0.3));
            grupo.add(columna);
          }
          const rampa = this.caja(0.65, 0.12, PUESTO_LARGO - 0.4, matMetal);
          rampa.position.set(lx * 0.78, 0.12, 0);
          elevable.add(rampa);
        }
        for (const lz of [-1, 1]) {
          const traviesa = this.caja(PUESTO_ANCHO - 0.1, 0.2, 0.3, matEstructura);
          traviesa.position.set(0, 0.2, lz * (PUESTO_LARGO / 2 - 0.3));
          elevable.add(traviesa);
        }
        elevable.userData['baseCoche'] = 0.18; // el coche apoya sobre las rampas
        break;
      }
      case 'foso': {
        // Hueco oscuro con borde de seguridad amarillo y negro
        const hueco = new THREE.Mesh(
          new THREE.PlaneGeometry(1.0, PUESTO_LARGO - 0.6),
          new THREE.MeshStandardMaterial({ color: '#111111' })
        );
        hueco.rotation.x = -Math.PI / 2;
        hueco.position.y = 0.006;
        grupo.add(hueco);
        const textura = this.texturaRayas();
        for (const lado of [-1, 1]) {
          const borde = new THREE.Mesh(
            new THREE.PlaneGeometry(0.2, PUESTO_LARGO - 0.6),
            new THREE.MeshBasicMaterial({ map: textura })
          );
          borde.rotation.x = -Math.PI / 2;
          borde.position.set(lado * 0.6, 0.007, 0);
          grupo.add(borde);
        }
        break;
      }
      case 'lavado': {
        // Arco de lavado con dos rodillos
        const matArco = new THREE.MeshStandardMaterial({ color: p.color || '#0288d1', metalness: 0.2 });
        for (const lado of [-1, 1]) {
          const pilar = this.caja(0.3, 3.0, 0.4, matArco);
          pilar.position.set(lado * (PUESTO_ANCHO / 2 - 0.1), 1.5, -1.4);
          grupo.add(pilar);
          const rodillo = new THREE.Mesh(
            new THREE.CylinderGeometry(0.35, 0.35, 2.4, 16),
            new THREE.MeshStandardMaterial({ color: '#4fc3f7', roughness: 1 })
          );
          rodillo.position.set(lado * (PUESTO_ANCHO / 2 - 0.55), 1.3, -1.4);
          rodillo.castShadow = true;
          grupo.add(rodillo);
        }
        const viga = this.caja(PUESTO_ANCHO, 0.3, 0.4, matArco);
        viga.position.set(0, 3.0, -1.4);
        grupo.add(viga);
        break;
      }
      case 'plaza':
      default:
        break;
    }

    // Etiqueta con el nombre del puesto, pintada en el suelo delante
    if (p.etiqueta) {
      const tex = this.texturaTexto(p.etiqueta, { fondo: 'rgba(0,0,0,0)', color: '#ffffff', ancho: 512, alto: 96, tam: 60, sombra: true });
      const rotulo = new THREE.Mesh(
        new THREE.PlaneGeometry(2.6, 2.6 * (96 / 512)),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
      );
      rotulo.rotation.x = -Math.PI / 2;
      rotulo.position.set(0, 0.01, PUESTO_LARGO / 2 + 0.35);
      grupo.add(rotulo);
    }

    // Marco de selección (solo visible al seleccionar en modo edición)
    const seleccion = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(PUESTO_ANCHO + 0.3, 0.05, PUESTO_LARGO + 0.9)),
      new THREE.LineBasicMaterial({ color: '#00e5ff' })
    );
    seleccion.position.set(0, 0.03, 0.25);
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
      if ((o as THREE.Mesh).isMesh && o !== zona) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });

    this.estatico.add(grupo);
    this.puestos.set(p.key, { datos: p, grupo, elevable, seleccion });
  }

  /** Líneas pintadas del contorno del puesto. */
  private marcasSuelo(grupo: THREE.Group, color: string, relleno?: string): void {
    const mat = new THREE.MeshBasicMaterial({ color });
    const g = 0.1;
    const lineas: [number, number, number, number][] = [
      [PUESTO_ANCHO, g, 0, -PUESTO_LARGO / 2],
      [PUESTO_ANCHO, g, 0, PUESTO_LARGO / 2],
      [g, PUESTO_LARGO, -PUESTO_ANCHO / 2, 0],
      [g, PUESTO_LARGO, PUESTO_ANCHO / 2, 0],
    ];
    for (const [w, h, x, z] of lineas) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.005, z);
      grupo.add(m);
    }
    if (relleno) {
      const r = new THREE.Mesh(
        new THREE.PlaneGeometry(PUESTO_ANCHO, PUESTO_LARGO),
        new THREE.MeshStandardMaterial({ color: relleno, transparent: true, opacity: 0.35 })
      );
      r.rotation.x = -Math.PI / 2;
      r.position.y = 0.004;
      grupo.add(r);
    }
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

    const carroceria = new THREE.MeshStandardMaterial({
      color: datos.CarColor || '#1976d2', metalness: 0.45, roughness: 0.35,
    });
    const cristal = new THREE.MeshStandardMaterial({
      color: '#263238', metalness: 0.9, roughness: 0.1, transparent: true, opacity: 0.85,
    });
    const negro = new THREE.MeshStandardMaterial({ color: '#1b1b1b', roughness: 0.9 });
    const llanta = new THREE.MeshStandardMaterial({ color: '#b0bec5', metalness: 0.8, roughness: 0.3 });

    // Carrocería baja, capó y maletero
    const bajos = this.caja(1.8, 0.55, 4.3, carroceria);
    bajos.position.y = 0.6;
    grupo.add(bajos);
    // Habitáculo con cristales
    const cabina = this.caja(1.55, 0.55, 2.1, cristal);
    cabina.position.set(0, 1.12, -0.2);
    grupo.add(cabina);
    const techo = this.caja(1.5, 0.06, 1.7, carroceria);
    techo.position.set(0, 1.42, -0.25);
    grupo.add(techo);
    // Parachoques
    for (const z of [-2.17, 2.17]) {
      const parachoques = this.caja(1.82, 0.22, 0.12, negro);
      parachoques.position.set(0, 0.42, z);
      grupo.add(parachoques);
    }
    // Ruedas
    for (const x of [-0.88, 0.88]) {
      for (const z of [-1.35, 1.35]) {
        const rueda = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.26, 20), negro);
        rueda.rotation.z = Math.PI / 2;
        rueda.position.set(x, 0.34, z);
        grupo.add(rueda);
        const tapacubos = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.27, 12), llanta);
        tapacubos.rotation.z = Math.PI / 2;
        tapacubos.position.copy(rueda.position);
        grupo.add(tapacubos);
      }
    }
    // Faros y pilotos
    const faro = new THREE.MeshStandardMaterial({ color: '#fffde7', emissive: '#fff9c4', emissiveIntensity: 0.6 });
    const piloto = new THREE.MeshStandardMaterial({ color: '#c62828', emissive: '#b71c1c', emissiveIntensity: 0.5 });
    for (const x of [-0.62, 0.62]) {
      const f = this.caja(0.42, 0.14, 0.05, faro);
      f.position.set(x, 0.72, 2.16);
      grupo.add(f);
      const pt = this.caja(0.42, 0.14, 0.05, piloto);
      pt.position.set(x, 0.72, -2.16);
      grupo.add(pt);
    }
    // Matrículas delante y detrás
    const texMatricula = this.texturaMatricula(datos.Matricula || '');
    for (const [z, rotY] of [[2.24, 0], [-2.24, Math.PI]] as [number, number][]) {
      const placa = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.12), new THREE.MeshBasicMaterial({ map: texMatricula }));
      placa.position.set(0, 0.46, z);
      placa.rotation.y = rotY;
      grupo.add(placa);
    }

    grupo.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });

    // Anillo de color según el estado de la cita (y resalte al seleccionar)
    const anillo = new THREE.Mesh(
      new THREE.RingGeometry(2.55, 2.75, 48),
      new THREE.MeshBasicMaterial({ color: COLOR_ESTADO[datos.Status] || '#9e9e9e', side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
    );
    anillo.rotation.x = -Math.PI / 2;
    anillo.position.y = 0.03;
    anillo.scale.set(0.75, 1, 1);
    grupo.add(anillo);

    // Cartel flotante con matrícula y modelo
    const cartel = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.texturaEtiquetaCoche(datos),
      depthTest: false,
      transparent: true,
    }));
    cartel.scale.set(2.6, 0.65, 1);
    cartel.position.set(0, 2.35, 0);
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
      c.carroceria.emissive.set(sel ? '#00e5ff' : '#000000');
      c.carroceria.emissiveIntensity = sel ? 0.1 : 0;
      c.anillo.scale.set(sel ? 0.85 : 0.75, 1, sel ? 1.1 : 1);
    }
    for (const [key, p] of this.puestos) {
      p.seleccion.visible = this.modoEdicion && key === this.puestoSeleccionado;
    }
  }

  // =================================================================
  //  Interacción
  // =================================================================

  private onPointerDown = (ev: PointerEvent): void => {
    this.pulsadoEn.set(ev.clientX, ev.clientY);
    if (!this.modoEdicion) return;
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
  };

  private onPointerUp = (ev: PointerEvent): void => {
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

  /** Devuelve qué hay bajo el puntero: un coche (con su puesto) o un puesto. */
  private pickEn(ev: PointerEvent): { tipo: string; id?: number; key?: string } | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.puntero.set(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.puntero, this.camera);
    const hits = this.raycaster.intersectObjects(this.estatico.children, true);
    for (const hit of hits) {
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

  private caja(w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh {
    return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  }

  private texturaTexto(texto: string, o: { fondo: string; color: string; ancho: number; alto: number; tam: number; sombra?: boolean }): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = o.ancho;
    canvas.height = o.alto;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = o.fondo;
    ctx.fillRect(0, 0, o.ancho, o.alto);
    ctx.font = `bold ${o.tam}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (o.sombra) {
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 8;
    }
    ctx.fillStyle = o.color;
    ctx.fillText(texto, o.ancho / 2, o.alto / 2, o.ancho - 20);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  /** Matrícula europea: banda azul con «E» y caracteres negros sobre blanco. */
  private texturaMatricula(matricula: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 520;
    canvas.height = 120;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 520, 120);
    ctx.fillStyle = '#003399';
    ctx.fillRect(0, 0, 60, 120);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 40px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('E', 30, 95);
    ctx.fillStyle = '#111111';
    ctx.font = 'bold 82px Arial';
    ctx.textBaseline = 'middle';
    ctx.fillText(matricula.toUpperCase(), 290, 64, 440);
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, 514, 114);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /** Cartel flotante: matrícula y marca/modelo con el color del estado. */
  private texturaEtiquetaCoche(d: CocheEnTaller): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    const color = COLOR_ESTADO[d.Status] || '#607d8b';
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    this.rectRedondeado(ctx, 4, 4, 504, 120, 22);
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.fillStyle = '#111';
    ctx.textAlign = 'center';
    ctx.font = 'bold 50px Arial';
    ctx.fillText((d.Matricula || '').toUpperCase(), 256, 58, 470);
    ctx.fillStyle = '#555';
    ctx.font = '32px Arial';
    ctx.fillText(`${d.Marca} ${d.Modelo}`.trim(), 256, 102, 470);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private texturaRayas(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    for (let i = 0; i < 16; i++) {
      ctx.fillStyle = i % 2 ? '#111111' : '#fdd835';
      ctx.fillRect(0, i * 16, 32, 16);
    }
    return new THREE.CanvasTexture(canvas);
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
