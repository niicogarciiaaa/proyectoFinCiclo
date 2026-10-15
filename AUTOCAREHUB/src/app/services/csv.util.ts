/**
 * Genera y descarga un fichero CSV (separador «;» y BOM UTF-8 para que
 * Excel en español lo abra con acentos y columnas correctas).
 */
export function descargarCsv(nombreFichero: string, cabeceras: string[], filas: unknown[][]): void {
  const escapar = (valor: unknown): string => {
    let texto = valor === null || valor === undefined ? '' : String(valor);
    if (typeof valor === 'number') {
      texto = texto.replace('.', ','); // decimales a la española
    }
    // Evitar inyección de fórmulas al abrir el CSV en una hoja de cálculo.
    if (/^[=+\-@]/.test(texto) && typeof valor !== 'number') {
      texto = "'" + texto;
    }
    return /[";\n\r]/.test(texto) ? '"' + texto.replace(/"/g, '""') + '"' : texto;
  };

  const lineas = [cabeceras, ...filas].map((fila) => fila.map(escapar).join(';'));
  const blob = new Blob(['﻿' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreFichero.replace(/[^\w.\-]+/g, '_');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
