<?php
require_once __DIR__ . '/../models/Tracking.php';

/**
 * Controlador del seguimiento de la reparación paso a paso.
 *  - El taller marca en qué etapa está cada coche (con una nota opcional).
 *  - El cliente consulta la línea de tiempo de sus citas.
 */
class TrackingController {
    private $model;
    private $userId;
    private $userRole;

    private const MAX_NOTA = 500;

    public function __construct($db, $userId, $userRole) {
        $this->model    = new TrackingModel($db);
        $this->userId   = (int)$userId;
        $this->userRole = $userRole;
    }

    /** Etapas disponibles, en orden. */
    public function etapas() {
        $lista = [];
        foreach (TrackingModel::ETAPAS as $clave => $nombre) {
            $lista[] = ['Stage' => $clave, 'StageLabel' => $nombre];
        }
        $this->sendResponse(200, true, "", ['etapas' => $lista]);
    }

    /** Última etapa de cada cita del taller o del cliente que llama. */
    public function resumen() {
        if ($this->userRole === 'Taller') {
            $wid = $this->model->getWorkshopIdByUserId($this->userId);
            if ($wid === null) {
                return $this->sendResponse(404, false, "No se encontró el taller asociado a tu cuenta");
            }
            $mapa = $this->model->getLatestStages('WorkshopID', $wid);
        } elseif ($this->userRole === 'Usuario') {
            $mapa = $this->model->getLatestStages('UserID', $this->userId);
        } else {
            return $this->sendResponse(403, false, "No autorizado");
        }
        // Objeto { AppointmentID: etapa } (forzado a objeto aunque esté vacío)
        $this->sendResponse(200, true, "", ['seguimiento' => (object)$mapa]);
    }

    /** Línea de tiempo de una cita (su cliente o su taller). */
    public function historial($data) {
        $cita = $this->citaAutorizada($data);
        if ($cita === null) return;
        $this->sendResponse(200, true, "", ['historial' => $this->model->getHistory((int)$cita['AppointmentID'])]);
    }

    /** (Taller) Registra una nueva etapa para una cita. */
    public function avanzar($data) {
        if ($this->userRole !== 'Taller') {
            return $this->sendResponse(403, false, "Solo el taller puede actualizar el seguimiento");
        }
        $cita = $this->citaAutorizada($data);
        if ($cita === null) return;

        if ($cita['Status'] === 'Cancelada') {
            return $this->sendResponse(400, false, "La cita está cancelada");
        }
        $etapa = $data['Etapa'] ?? '';
        if (!is_string($etapa) || !array_key_exists($etapa, TrackingModel::ETAPAS)) {
            return $this->sendResponse(400, false, "Etapa no válida");
        }
        $nota = trim((string)($data['Nota'] ?? ''));
        if (mb_strlen($nota) > self::MAX_NOTA) {
            return $this->sendResponse(400, false, "La nota no puede superar " . self::MAX_NOTA . " caracteres");
        }
        $nota = $nota === '' ? null : strip_tags($nota);

        $id = (int)$cita['AppointmentID'];
        if (!$this->model->add($id, (int)$cita['WorkshopID'], $etapa, $nota, $this->userId)) {
            return $this->sendResponse(500, false, "Error al guardar la etapa");
        }
        $this->sendResponse(200, true, "Seguimiento actualizado", ['historial' => $this->model->getHistory($id)]);
    }

    /** (Taller) Deshace la última etapa registrada de una cita. */
    public function deshacer($data) {
        if ($this->userRole !== 'Taller') {
            return $this->sendResponse(403, false, "Solo el taller puede actualizar el seguimiento");
        }
        $cita = $this->citaAutorizada($data);
        if ($cita === null) return;

        $id = (int)$cita['AppointmentID'];
        if (!$this->model->deleteLast($id, (int)$cita['WorkshopID'])) {
            return $this->sendResponse(400, false, "No hay ninguna etapa que deshacer");
        }
        $this->sendResponse(200, true, "Última etapa eliminada", ['historial' => $this->model->getHistory($id)]);
    }

    /**
     * Devuelve la cita si quien llama es su cliente o su taller; si no,
     * responde con el error y devuelve null.
     */
    private function citaAutorizada($data) {
        $id = (int)($data['AppointmentID'] ?? 0);
        if ($id <= 0) {
            $this->sendResponse(400, false, "Falta la cita");
            return null;
        }
        $cita = $this->model->getAppointment($id);
        $permitido = false;
        if ($cita) {
            if ($this->userRole === 'Usuario') {
                $permitido = (int)$cita['UserID'] === $this->userId;
            } elseif ($this->userRole === 'Taller') {
                $permitido = (int)$cita['WorkshopID'] === $this->model->getWorkshopIdByUserId($this->userId);
            }
        }
        if (!$permitido) {
            // Mismo mensaje si no existe o no es suya, para no revelar citas ajenas.
            $this->sendResponse(404, false, "Cita no encontrada");
            return null;
        }
        return $cita;
    }

    private function sendResponse($code, $success, $message, $data = []) {
        http_response_code($code);
        echo json_encode(array_merge(["success" => $success, "message" => $message], $data));
        return true;
    }
}
?>
