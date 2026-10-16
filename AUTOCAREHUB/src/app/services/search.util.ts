/**
 * Búsqueda sencilla para las listas: sin distinguir mayúsculas ni tildes y
 * con varias palabras a la vez («laura seat» encuentra las filas que tengan
 * las dos, en cualquier campo).
 */
export function normalizar(texto: unknown): string {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** true si todas las palabras de `consulta` aparecen en alguno de los campos. */
export function coincideBusqueda(consulta: string, campos: unknown[]): boolean {
  const palabras = normalizar(consulta).split(/\s+/).filter(Boolean);
  if (!palabras.length) return true;
  const texto = campos.map(normalizar).join(' | ');
  return palabras.every((p) => texto.includes(p));
}

/**
 * Variantes de una fecha 'YYYY-MM-DD[ HH:MM:SS]' para que se pueda buscar
 * como se escribe en España: «14/10/2026», «14/10» o «2026-10-14».
 */
export function fechaBuscable(fecha: string | null | undefined): string {
  if (!fecha) return '';
  const [a, m, d] = fecha.substring(0, 10).split('-');
  if (!d) return fecha;
  return `${fecha} ${d}/${m}/${a} ${+d}/${+m}/${a}`;
}
