# AutoCareHub — Guía para Claude

Aplicación de gestión de taller de coches. **Frontend** Angular en `AUTOCAREHUB/`
(dev en `localhost:4200`). **Backend** PHP en `PHP/` que Apache sirve desde una copia
en `/Applications/XAMPP/htdocs/PHP` (¡hay que copiar ahí tras editar PHP!).
**BD** MySQL (XAMPP), usuario `hmi`/`hmi`, base `AutoCareHub`.

## Al empezar una sesión
1. Lee `Documentacion/MEJORAS_AutoCareHub.md`: es el registro vivo y al día de todo lo
   implementado y de las mejoras pendientes.
2. Cuentas de prueba (pass `abc123`): `taller@autocare.com`, `cliente@autocare.com`.

## Normas del proyecto (obligatorias)
- **No modificar la API existente.** Los endpoints/archivos PHP que ya existían se
  dejan EXACTAMENTE como estaban. La funcionalidad nueva va en **llamadas nuevas**
  (p. ej. `PHP/routes/schedule.php`). El frontend Angular sí se puede editar.
- **Documentar cada mejora.** Cada vez que se implementa una mejora: añadirla a
  `Documentacion/MEJORAS_AutoCareHub.md`, quitarla de «Próximas mejoras», actualizar la
  fecha y regenerar el PDF con:
  `cd Documentacion && python3 md_to_pdf.py MEJORAS_AutoCareHub.md MEJORAS_AutoCareHub.pdf`
- Tras editar PHP, copiarlo a `/Applications/XAMPP/htdocs/PHP` para que surta efecto.

## Verificación
- Frontend: `cd AUTOCAREHUB && node_modules/.bin/ng build --configuration development`.
- PHP: `/Applications/XAMPP/bin/php -l <archivo>`.
- Endpoints: login por `curl` con cookie y luego POST con `accion`. Nota: el taller está
  cerrado sábados y domingos por defecto (la reserva los rechaza).
