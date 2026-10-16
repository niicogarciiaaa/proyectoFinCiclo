/**
 * Etapas del seguimiento de la reparación (mismas claves que
 * TrackingModel::ETAPAS en el backend), en orden.
 */
export interface EtapaSeguimiento {
  clave: string;
  nombre: string;
  icono: string;
}

export const ETAPAS_SEGUIMIENTO: EtapaSeguimiento[] = [
  { clave: 'recibido', nombre: 'Vehículo recibido', icono: 'bi-box-arrow-in-down' },
  { clave: 'diagnostico', nombre: 'En diagnóstico', icono: 'bi-search' },
  { clave: 'esperando_piezas', nombre: 'Esperando piezas', icono: 'bi-hourglass-split' },
  { clave: 'reparacion', nombre: 'En reparación', icono: 'bi-tools' },
  { clave: 'listo', nombre: 'Listo para recoger', icono: 'bi-check2-circle' },
  { clave: 'entregado', nombre: 'Entregado', icono: 'bi-flag' },
];

/** Entrada de la línea de tiempo tal y como la devuelve tracking.php. */
export interface PasoSeguimiento {
  ProgressID: number;
  Stage: string;
  StageLabel: string;
  Note: string | null;
  CreatedAt: string;
}

/** Posición (0..5) de una etapa, o -1 si no tiene. */
export function indiceEtapa(clave: string | null | undefined): number {
  return ETAPAS_SEGUIMIENTO.findIndex((e) => e.clave === clave);
}

/** 'YYYY-MM-DD HH:MM:SS' → «17 oct, 10:35». */
export function fechaPaso(dt: string): string {
  const d = new Date((dt || '').replace(' ', 'T'));
  if (isNaN(d.getTime())) return dt;
  return d.toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
