/** La cita debería haber terminado ya y no está finalizada. */
export function cocheConRetraso(c: { EndDateTime?: string; Status: string }, ahora = new Date()): boolean {
  if (!c.EndDateTime || c.Status === 'Finalizada' || c.Status === 'Cancelada') return false;
  return new Date(c.EndDateTime.replace(' ', 'T')) < ahora;
}
