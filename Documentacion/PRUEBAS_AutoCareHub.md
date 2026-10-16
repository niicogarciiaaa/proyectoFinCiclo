# AutoCareHub — Lista de pruebas

**Proyecto:** AutoCareHub (Angular + PHP/MySQL)
**Autor:** Nicolás García Moreira
**Última actualización:** 17/10/2026

> Cada punto indica qué hacer y qué se debería ver (→). Hazla primero en **local** y
> repite en la **web publicada** los puntos marcados con 🌐. Cuentas de prueba (contraseña
> `abc123`): `taller@autocare.com` y `cliente@autocare.com`.

---

## 0. Preparación

- [ ] XAMPP arrancado (Apache y MySQL) → `http://localhost/phpmyadmin` abre.
- [ ] PHP copiado a `htdocs` (`rsync` de la carpeta `PHP/`) y migraciones ejecutadas en la base `AutoCareHub`.
- [ ] `npm start` en `AUTOCAREHUB` → `http://localhost:4200/Autocare/frontend/` muestra el login.
- [ ] Una ventana normal con el **taller** y otra de incógnito con el **cliente**.

## 1. Acceso y seguridad 🌐

- [ ] Login con una contraseña incorrecta → mensaje de error, no entra.
- [ ] Login como cliente → inicio del cliente con su menú.
- [ ] Sin sesión, escribir en la barra `/Autocare/frontend/misCitas` → manda al login.
- [ ] Como cliente, escribir `/Autocare/frontend/taller3d` → manda al inicio (ruta solo para taller).
- [ ] Cerrar sesión → vuelve al login y «Atrás» no deja entrar.
- [ ] Registro de un usuario nuevo → se crea y puede iniciar sesión.

## 2. Configuración del taller (cuenta del taller)

- [ ] **Agenda Inteligente → Horario:** cambiar el horario de un día y guardar → al recargar se mantiene.
- [ ] **Servicios:** crear uno («Cambio de aceite», 60 min, 65 €), editarlo y desactivarlo → se guarda.
- [ ] **Días de cierre:** añadir un festivo → aparece; borrarlo → desaparece.
- [ ] **Datos fiscales:** guardar NIF y razón social → se guardan (hacen falta para el QR de VeriFactu).

## 3. Cliente: vehículos y citas

- [ ] **Registrar vehículo:** añadir uno → aparece en la lista; editarlo y borrarlo.
- [ ] **Pedir cita:** elegir taller y servicio → solo salen los huecos libres según horario y duración.
  - [ ] Sábado o domingo con el horario por defecto → no hay huecos.
  - [ ] El festivo del punto 2 → no hay huecos.
  - [ ] Reservar una cita → confirmación y estado *Pendiente*.
- [ ] **Mis Citas:**
  - [ ] Filtros *Próximas* / *Todas* → cambia la lista.
  - [ ] Buscador: la marca del coche, «aceite» o `17/10` → filtra y muestra «X de Y resultados»; la X o Esc lo limpia.
  - [ ] **Reprogramar** una cita → cambia la fecha.
  - [ ] **Cancelar** otra → pasa a *Cancelada*.
  - [ ] Recordatorio arriba si hay citas en las próximas 48 h.
- [ ] **Historial de vehículos:** se ven las visitas → *Exportar CSV* descarga un fichero que abre bien en Excel.

## 4. Taller: agenda y citas

- [ ] **Inicio:** las citas de hoy y las pendientes de confirmar cuadran con los datos.
- [ ] **Menú:** junto a *Agenda Semanal* sale un número naranja con las pendientes.
- [ ] **Agenda Semanal:** aparece la cita nueva → **confirmarla** → al cambiar de pantalla, el número del menú baja.
- [ ] **Ver citas:**
  - [ ] La tabla se ve con estilo y el buscador filtra.
  - [ ] Columna *Seguimiento* → *Actualizar* → «Vehículo recibido» con una nota → guardar → la columna lo muestra.
  - [ ] Avanzar a «En diagnóstico» → **Deshacer la última** → vuelve a «Vehículo recibido».

## 5. Taller 3D

- [ ] Carga la escena con los puestos y la barra superior muestra «X/Y puestos».
- [ ] **Por colocar:** *Meter* un coche → aparece en el primer puesto libre.
- [ ] **Arrastrar** una tarjeta de «Por colocar» al visor 3D → se marcan los puestos libres; al soltar, el coche aparece.
  - [ ] Soltarla sobre un puesto ocupado → aviso «ya está ocupado».
- [ ] **Arrastrar un coche** del 3D a otro puesto libre → se mueve.
  - [ ] Sobre un puesto ocupado → pregunta si intercambiar → *Aceptar* → los dos coches se cambian.
  - [ ] Fuera de cualquier puesto → vuelve a su sitio.
- [ ] **Pasar el ratón** por un coche → aviso con matrícula, servicio, horario y «Faltan X min» / «Retraso de…».
- [ ] Coche con la hora de fin pasada → **RETRASO** en el 3D, la lista y la ficha, y «N con retraso» arriba.
- [ ] **Pulsar un coche** → se abre la ficha:
  - [ ] Confirmar / Finalizar cambian el estado.
  - [ ] *Seguimiento para el cliente* funciona igual que en Ver citas.
  - [ ] Cambiar el color → el coche cambia de color.
  - [ ] *Subir elevador* (solo en elevadores) → sube con animación; el **doble clic** en el coche hace lo mismo.
  - [ ] Añadir y borrar una **nota**.
  - [ ] *Sacar del taller* → vuelve a «Por colocar».
- [ ] **Buscar matrícula** → enfoca el coche y abre su ficha; con un coche por colocar → aviso con su hora.
- [ ] **Leyenda:** pulsar *Finalizada* → esos coches se vuelven transparentes; otra vez → vuelven.
- [ ] **Botones de cámara:** imagen (descarga `taller-AAAA-MM-DD.png`), giro, pantalla completa, vista inicial y planta.
- [ ] **Atajos:** `?` muestra la lista; probar `/ I P F G C E Esc`.
- [ ] Mover la cámara, ir a otra pantalla y volver → la cámara está donde se dejó.
- [ ] **Editar distribución:**
  - [ ] Arrastrar un puesto y girarlo.
  - [ ] Añadir un lavado, duplicarlo, borrarlo y cambiar el color de acento.
  - [ ] *Guardar* → al recargar se mantiene; *Descartar* → vuelve a como estaba; *Restablecer* → por defecto.

## 6. Facturas y VeriFactu

- [ ] Desde la ficha de una cita *Finalizada* → **Facturar** → el generador se abre con la cita y los conceptos rellenados.
- [ ] Añadir otra línea con IVA del 10 % → los totales se recalculan → crear la factura.
- [ ] **PDF (taller):**
  - [ ] Logo bien proporcionado, franja resumen, 3 tarjetas, tabla e IVA desglosado por tipo.
  - [ ] **Bloque VeriFactu con QR**; al escanearlo con el móvil abre la web de la AEAT.
  - [ ] Pie con «Página 1 de 1».
- [ ] Factura con 20 o más líneas → el PDF pasa a **varias páginas** sin cortar nada.
- [ ] Buscadores de facturas y de citas en esa pantalla → filtran.
- [ ] **Cliente → Ver facturas:**
  - [ ] Sale la factura nueva y el buscador filtra.
  - [ ] *Descargar PDF* → mismo diseño, con QR si tiene registro VeriFactu.
  - [ ] En el menú, el número de *Ver facturas* cuenta las pendientes de pago.

## 7. Seguimiento (vista del cliente)

- [ ] En **Mis Citas**, la cita del punto 4 muestra la barra de etapas, la etapa actual y la nota.
- [ ] *Ver historial* → lista de etapas con fechas.
- [ ] Avanzar la etapa desde el taller y recargar en el cliente → se actualiza.
- [ ] Las citas sin seguimiento no muestran nada.

## 8. Estadísticas y exportación (taller)

- [ ] Cambiar fechas y rangos rápidos → cambian indicadores, gráficos y tablas.
- [ ] Exportar CSV → abre bien en Excel, con acentos y columnas correctas.
- [ ] **Exportación para el gestor:** trimestre actual → *Descargar Excel*:
  - [ ] Abre en Excel o Numbers con 3 hojas: *Resumen*, *Libro IVA repercutido* y *Facturas*.
  - [ ] Fechas en formato fecha e importes en €.
  - [ ] Base, cuota y total del Resumen coinciden con la suma de las facturas.
  - [ ] Debajo del botón: «Descargado 4T 2026: N facturas · X €».
- [ ] Trimestre sin facturas → el Excel sale vacío pero abre bien.

## 9. Reseñas

- [ ] Cliente: cita *Finalizada* → **★ Valorar** → 4 estrellas y comentario → enviar → ya no se puede volver a valorar.
- [ ] Taller: en Estadísticas aparecen la media y la reseña nueva.

## 10. Chat (solo en local)

- [ ] El cliente inicia un chat con el taller y envía un mensaje.
- [ ] El taller ve el número de sin leer en el menú → abre el chat → baja a 0 → responde.
- [ ] 🌐 En la web publicada **no funciona**: InfinityFree bloquea `chats.php`.

## 11. Administrador (si hay una cuenta de administrador)

- [ ] Gestión de talleres: crear, editar y ver los talleres.

## 12. Aspecto y otros 🌐

- [ ] **Modo oscuro** en varias pantallas → se lee bien; imágenes, QR y 3D con sus colores normales.
- [ ] **Móvil:** ventana estrecha o móvil → el menú se pliega y sale el punto naranja si hay avisos; Mis Citas, facturas y 3D se pueden usar.
- [ ] **Teclado:** Tab recorre los botones con el foco visible.

## 13. Web publicada y despliegue 🌐

- [ ] Cambio pequeño + push a `main` → en *GitHub → Actions*, «Deploy InfinityFree» termina en verde.
- [ ] Con la web abierta durante un despliegue, navegar a otra pantalla → como mucho se recarga una vez, sin pantalla en blanco.
- [ ] Consola del navegador (F12) sin errores repetidos (solo uno de chats, que es lo esperado).
- [ ] **Ficha del coche del Taller 3D en producción** → comprobar que abre; si falla, anotar *Red → garage.php → Respuesta*.

---

*Anota junto a cada punto que falle qué ha pasado (pantalla, mensaje y pasos) para poder corregirlo.*
