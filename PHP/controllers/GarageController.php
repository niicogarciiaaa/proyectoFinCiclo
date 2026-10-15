<?php
require_once __DIR__ . '/../models/Garage.php';

/**
 * Controlador del «Taller en 3D» (solo rol Taller).
 *  - Distribución personalizable del taller.
 *  - Colocar / mover / sacar coches de los puestos y subir o bajar el elevador.
 *  - Ficha del coche con sus datos, visitas anteriores y notas.
 */
class GarageController {
    private $model;
    private $userId;
    private $userRole;
    private $workshop = null;

    private const MAX_PUESTOS = 40;

    public function __construct($db, $userId, $userRole) {
        $this->model    = new GarageModel($db);
        $this->userId   = (int)$userId;
        $this->userRole = $userRole;
    }

    /** Todo lo que necesita la vista 3D en una sola llamada. */
    public function obtener($data) {
        if (!$this->requireWorkshop()) return;
        $wid = (int)$this->workshop['WorkshopID'];

        $fecha = $data['Fecha'] ?? date('Y-m-d');
        if (!$this->esFechaValida($fecha)) {
            return $this->sendResponse(400, false, "Fecha no válida");
        }

        $layout = $this->model->getLayout($wid) ?? GarageModel::defaultLayout($this->workshop['Name']);

        $this->sendResponse(200, true, "", [
            'layout'     => $layout,
            'coches'     => $this->model->getAssignments($wid),
            'pendientes' => $this->model->getPendingCars($wid, $fecha),
            'fecha'      => $fecha,
        ]);
    }

    /** Guarda la distribución (validada y saneada en el servidor). */
    public function guardarLayout($data) {
        if (!$this->requireWorkshop()) return;
        $wid = (int)$this->workshop['WorkshopID'];

        if (!isset($data['layout']) || !is_array($data['layout'])) {
            return $this->sendResponse(400, false, "Falta la distribución");
        }
        $error = null;
        $layout = $this->sanearLayout($data['layout'], $error);
        if ($layout === null) {
            return $this->sendResponse(400, false, $error);
        }
        if (!$this->model->saveLayout($wid, $layout)) {
            return $this->sendResponse(500, false, "Error al guardar la distribución");
        }
        // Si se ha borrado un puesto que tenía coche, ese coche vuelve a "pendientes".
        $keys = array_map(fn($p) => $p['key'], $layout['puestos']);
        $this->model->removeAssignmentsNotIn($wid, $keys);

        $this->sendResponse(200, true, "Distribución guardada", ['layout' => $layout]);
    }

    /** Restablece la distribución por defecto. */
    public function restablecerLayout() {
        if (!$this->requireWorkshop()) return;
        $wid = (int)$this->workshop['WorkshopID'];
        $layout = GarageModel::defaultLayout($this->workshop['Name']);
        $this->model->saveLayout($wid, $layout);
        $keys = array_map(fn($p) => $p['key'], $layout['puestos']);
        $this->model->removeAssignmentsNotIn($wid, $keys);
        $this->sendResponse(200, true, "Distribución restablecida", ['layout' => $layout]);
    }

    /** Coloca un coche (cita) en un puesto libre, o lo mueve a otro. */
    public function asignar($data) {
        if (!$this->requireWorkshop()) return;
        $wid = (int)$this->workshop['WorkshopID'];

        $appointmentId = (int)($data['AppointmentID'] ?? 0);
        $bayKey = (string)($data['BayKey'] ?? '');
        $cita = $this->model->getWorkshopAppointment($appointmentId, $wid);
        if (!$cita) {
            return $this->sendResponse(404, false, "Cita no encontrada en tu taller");
        }
        if (in_array($cita['Status'], ['Cancelada'], true)) {
            return $this->sendResponse(409, false, "No se puede meter en el taller una cita cancelada");
        }
        if (!$this->puestoExiste($wid, $bayKey)) {
            return $this->sendResponse(400, false, "Ese puesto no existe en la distribución");
        }
        $ocupante = $this->model->getBayOccupant($wid, $bayKey);
        if ($ocupante !== null && $ocupante !== $appointmentId) {
            return $this->sendResponse(409, false, "Ese puesto ya está ocupado por otro coche");
        }
        $color = $this->colorValido($data['CarColor'] ?? null) ?? $this->colorPorDefecto($appointmentId);
        if (!$this->model->assign($wid, $appointmentId, $bayKey, $color)) {
            return $this->sendResponse(500, false, "Error al colocar el coche");
        }
        $this->sendResponse(200, true, "Coche colocado en el puesto", [
            'coches' => $this->model->getAssignments($wid),
        ]);
    }

    /** Cambia el color del coche o sube/baja el elevador. */
    public function actualizarCoche($data) {
        if (!$this->requireWorkshop()) return;
        $wid = (int)$this->workshop['WorkshopID'];

        $appointmentId = (int)($data['AppointmentID'] ?? 0);
        $actual = $this->model->getAssignment($wid, $appointmentId);
        if (!$actual) {
            return $this->sendResponse(404, false, "Ese coche no está en ningún puesto");
        }
        $color = array_key_exists('CarColor', $data)
            ? $this->colorValido($data['CarColor'])
            : $actual['CarColor'];
        if ($color === null) {
            return $this->sendResponse(400, false, "Color no válido (usa #RRGGBB)");
        }
        $lifted = array_key_exists('Lifted', $data) ? (!empty($data['Lifted']) ? 1 : 0) : (int)$actual['Lifted'];
        $this->model->updateCar($wid, $appointmentId, $color, $lifted);
        $this->sendResponse(200, true, "Coche actualizado", ['CarColor' => $color, 'Lifted' => (bool)$lifted]);
    }

    /** Saca un coche del taller (libera el puesto). */
    public function retirar($data) {
        if (!$this->requireWorkshop()) return;
        $wid = (int)$this->workshop['WorkshopID'];
        if (!$this->model->unassign($wid, (int)($data['AppointmentID'] ?? 0))) {
            return $this->sendResponse(404, false, "Ese coche no está en ningún puesto");
        }
        $this->sendResponse(200, true, "Coche fuera del taller");
    }

    /** Ficha del coche: vehículo, cliente, cita, visitas anteriores y notas. */
    public function detalle($data) {
        if (!$this->requireWorkshop()) return;
        $wid = (int)$this->workshop['WorkshopID'];

        $appointmentId = (int)($data['AppointmentID'] ?? 0);
        $detalle = $this->model->getCarDetail($appointmentId, $wid);
        if (!$detalle) {
            return $this->sendResponse(404, false, "Cita no encontrada en tu taller");
        }
        $this->sendResponse(200, true, "", [
            'detalle'  => $detalle,
            'puesto'   => $this->model->getAssignment($wid, $appointmentId),
            'visitas'  => $this->model->getVehicleVisits($detalle['VehicleID'], $wid, $appointmentId),
            'notas'    => $this->model->getNotes($detalle['VehicleID'], $wid),
        ]);
    }

    public function crearNota($data) {
        if (!$this->requireWorkshop()) return;
        $wid = (int)$this->workshop['WorkshopID'];

        $appointmentId = (int)($data['AppointmentID'] ?? 0);
        $texto = trim((string)($data['Note'] ?? ''));
        if ($texto === '') {
            return $this->sendResponse(400, false, "La nota está vacía");
        }
        $texto = mb_substr($texto, 0, 2000);
        $cita = $this->model->getWorkshopAppointment($appointmentId, $wid);
        if (!$cita) {
            return $this->sendResponse(404, false, "Cita no encontrada en tu taller");
        }
        $id = $this->model->addNote($wid, (int)$cita['VehicleID'], $appointmentId, $this->userId, $texto);
        if ($id === false) {
            return $this->sendResponse(500, false, "Error al guardar la nota");
        }
        $this->sendResponse(200, true, "Nota guardada", [
            'notas' => $this->model->getNotes((int)$cita['VehicleID'], $wid),
        ]);
    }

    public function eliminarNota($data) {
        if (!$this->requireWorkshop()) return;
        $wid = (int)$this->workshop['WorkshopID'];
        if (!$this->model->deleteNote((int)($data['NoteID'] ?? 0), $wid)) {
            return $this->sendResponse(404, false, "Nota no encontrada");
        }
        $this->sendResponse(200, true, "Nota eliminada");
    }

    // ===============================================================
    //  Validación de la distribución
    // ===============================================================

    /**
     * Devuelve la distribución saneada o null (con $error) si no es válida.
     * Nunca se guarda tal cual lo que envía el navegador.
     */
    private function sanearLayout($in, &$error) {
        $ancho = $this->numero($in['ancho'] ?? 26, 10, 80);
        $fondo = $this->numero($in['fondo'] ?? 16, 8, 60);

        $out = [
            'version'         => 1,
            'nombre'          => mb_substr(trim(strip_tags((string)($in['nombre'] ?? ''))), 0, 40),
            'ancho'           => $ancho,
            'fondo'           => $fondo,
            'colorSuelo'      => $this->colorValido($in['colorSuelo'] ?? null) ?? '#9e9e9e',
            'colorParedes'    => $this->colorValido($in['colorParedes'] ?? null) ?? '#eceff1',
            'colorElevadores' => $this->colorValido($in['colorElevadores'] ?? null) ?? '#fb8c00',
            'colorLineas'     => $this->colorValido($in['colorLineas'] ?? null) ?? '#fdd835',
            'puestos'         => [],
        ];

        $puestos = $in['puestos'] ?? [];
        if (!is_array($puestos)) {
            $error = "La lista de puestos no es válida";
            return null;
        }
        if (count($puestos) > self::MAX_PUESTOS) {
            $error = "Como máximo se admiten " . self::MAX_PUESTOS . " puestos";
            return null;
        }

        $keys = [];
        foreach ($puestos as $i => $p) {
            if (!is_array($p)) {
                $error = "Puesto " . ($i + 1) . " no válido";
                return null;
            }
            $key = (string)($p['key'] ?? '');
            if (!preg_match('/^[A-Za-z0-9_-]{1,40}$/', $key) || isset($keys[$key])) {
                $error = "Identificador de puesto no válido o repetido: " . mb_substr($key, 0, 40);
                return null;
            }
            $keys[$key] = true;
            $tipo = (string)($p['tipo'] ?? '');
            if (!in_array($tipo, GarageModel::TIPOS, true)) {
                $error = "Tipo de puesto no válido: " . mb_substr($tipo, 0, 20);
                return null;
            }
            $puesto = [
                'key'      => $key,
                'tipo'     => $tipo,
                'etiqueta' => mb_substr(trim(strip_tags((string)($p['etiqueta'] ?? ''))), 0, 30),
                // Dentro de los límites del taller.
                'x'        => $this->numero($p['x'] ?? 0, -$ancho / 2, $ancho / 2),
                'z'        => $this->numero($p['z'] ?? 0, -$fondo / 2, $fondo / 2),
                'rot'      => $this->grados($p['rot'] ?? 0),
            ];
            $color = $this->colorValido($p['color'] ?? null);
            if ($color !== null) {
                $puesto['color'] = $color;
            }
            $out['puestos'][] = $puesto;
        }
        return $out;
    }

    private function puestoExiste($workshopId, $bayKey) {
        $layout = $this->model->getLayout($workshopId) ?? GarageModel::defaultLayout('');
        foreach ($layout['puestos'] as $p) {
            if ($p['key'] === $bayKey) {
                return true;
            }
        }
        return false;
    }

    private function numero($v, $min, $max) {
        $n = is_numeric($v) ? (float)$v : 0.0;
        return round(max($min, min($max, $n)), 2);
    }

    /** Normaliza un ángulo a [0, 360). */
    private function grados($v) {
        $n = is_numeric($v) ? (float)$v : 0.0;
        if (!is_finite($n)) {
            return 0.0;
        }
        return round(fmod(fmod($n, 360) + 360, 360), 2);
    }

    private function colorValido($c) {
        return (is_string($c) && preg_match('/^#[0-9a-fA-F]{6}$/', $c)) ? strtolower($c) : null;
    }

    /** Color estable por cita, para que cada coche se distinga sin configurar nada. */
    private function colorPorDefecto($appointmentId) {
        $paleta = ['#1976d2', '#d32f2f', '#388e3c', '#f5f5f5', '#212121', '#7b1fa2', '#ffa000', '#455a64', '#00838f'];
        return $paleta[$appointmentId % count($paleta)];
    }

    private function esFechaValida($fecha) {
        if (!is_string($fecha)) return false;
        $d = DateTime::createFromFormat('Y-m-d', $fecha);
        return $d !== false && $d->format('Y-m-d') === $fecha;
    }

    private function requireWorkshop() {
        if ($this->userRole !== 'Taller') {
            $this->sendResponse(403, false, "Solo los talleres pueden acceder a esta sección");
            return false;
        }
        $this->workshop = $this->model->getWorkshop($this->userId);
        if (!$this->workshop) {
            $this->sendResponse(404, false, "No se encontró el taller asociado a tu cuenta");
            return false;
        }
        return true;
    }

    private function sendResponse($code, $success, $message, $data = []) {
        http_response_code($code);
        echo json_encode(array_merge(["success" => $success, "message" => $message], $data));
        return true;
    }
}
?>
