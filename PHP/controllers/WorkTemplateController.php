<?php
require_once __DIR__ . '/../models/WorkTemplate.php';

/** Controlador de las plantillas de trabajo (solo rol Taller). */
class WorkTemplateController {
    private $model;
    private $workshopId = null;

    private const MAX_LINEAS = 50;

    public function __construct($db, $userId, $userRole) {
        $this->model = new WorkTemplateModel($db);
        if ($userRole === 'Taller') {
            $this->workshopId = $this->model->getWorkshopIdByUserId((int)$userId);
        }
    }

    public function listar() {
        if (!$this->requireWorkshop()) return;
        $this->sendResponse(200, true, "", ['plantillas' => $this->model->listar($this->workshopId)]);
    }

    public function guardar($data) {
        if (!$this->requireWorkshop()) return;
        $nombre = trim(strip_tags((string)($data['Nombre'] ?? '')));
        if ($nombre === '' || mb_strlen($nombre) > 80) {
            return $this->sendResponse(400, false, "El nombre es obligatorio (máximo 80 caracteres)");
        }
        $items = $data['Items'] ?? null;
        if (!is_array($items) || count($items) === 0 || count($items) > self::MAX_LINEAS) {
            return $this->sendResponse(400, false, "La plantilla debe tener entre 1 y " . self::MAX_LINEAS . " líneas");
        }
        $limpios = [];
        foreach ($items as $it) {
            $desc = trim(strip_tags((string)($it['description'] ?? '')));
            $cant = (float)($it['quantity'] ?? 0);
            $precio = (float)($it['unit_price'] ?? -1);
            $iva = (float)($it['tax_rate'] ?? -1);
            if ($desc === '' || mb_strlen($desc) > 255 || $cant <= 0 || $precio < 0 || $iva < 0 || $iva > 100) {
                return $this->sendResponse(400, false, "Hay líneas con datos no válidos");
            }
            $limpios[] = ['description' => $desc, 'quantity' => $cant, 'unit_price' => $precio, 'tax_rate' => $iva];
        }
        if (!$this->model->guardar($this->workshopId, $nombre, $limpios)) {
            return $this->sendResponse(500, false, "Error al guardar la plantilla");
        }
        $this->sendResponse(200, true, "Plantilla guardada", ['plantillas' => $this->model->listar($this->workshopId)]);
    }

    public function eliminar($data) {
        if (!$this->requireWorkshop()) return;
        if (!$this->model->eliminar((int)($data['TemplateID'] ?? 0), $this->workshopId)) {
            return $this->sendResponse(404, false, "Plantilla no encontrada");
        }
        $this->sendResponse(200, true, "Plantilla eliminada", ['plantillas' => $this->model->listar($this->workshopId)]);
    }

    private function requireWorkshop() {
        if ($this->workshopId === null) {
            $this->sendResponse(403, false, "Solo los talleres pueden usar las plantillas");
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
