<?php
require_once __DIR__ . '/../models/Stats.php';

/**
 * Controlador del dashboard de estadísticas ampliado (solo rol Taller).
 */
class StatsController {
    private $model;
    private $userId;
    private $userRole;

    public function __construct($db, $userId, $userRole) {
        $this->model    = new StatsModel($db);
        $this->userId   = (int)$userId;
        $this->userRole = $userRole;
    }

    /**
     * Devuelve en una sola llamada todo lo que necesita el dashboard:
     * indicadores, ingresos por periodo, servicios top y citas por estado.
     */
    public function resumen($data) {
        if ($this->userRole !== 'Taller') {
            return $this->sendResponse(403, false, "Solo los talleres pueden ver estas estadísticas");
        }
        $workshopId = $this->model->getWorkshopIdByUserId($this->userId);
        if ($workshopId === null) {
            return $this->sendResponse(404, false, "No se encontró el taller asociado a tu cuenta");
        }

        $end   = $data['FechaFin'] ?? date('Y-m-d');
        $start = $data['FechaInicio'] ?? date('Y-m-d', strtotime('-1 year'));
        if (!$this->esFechaValida($start) || !$this->esFechaValida($end) || $end < $start) {
            return $this->sendResponse(400, false, "Rango de fechas no válido");
        }
        $agrupacion = in_array($data['Agrupacion'] ?? '', ['dia', 'semana', 'mes'], true)
            ? $data['Agrupacion']
            : 'mes';

        $this->sendResponse(200, true, "", [
            'rango'       => ['inicio' => $start, 'fin' => $end, 'agrupacion' => $agrupacion],
            'indicadores' => $this->model->indicadores($workshopId, $start, $end),
            'ingresos'    => $this->model->ingresosPorPeriodo($workshopId, $start, $end, $agrupacion),
            'servicios'   => $this->model->topServicios($workshopId, $start, $end),
            'estados'     => $this->model->citasPorEstado($workshopId, $start, $end),
        ]);
    }

    private function esFechaValida($fecha) {
        if (!is_string($fecha)) return false;
        $d = DateTime::createFromFormat('Y-m-d', $fecha);
        return $d !== false && $d->format('Y-m-d') === $fecha;
    }

    private function sendResponse($code, $success, $message, $data = []) {
        http_response_code($code);
        echo json_encode(array_merge(["success" => $success, "message" => $message], $data));
        return true;
    }
}
?>
