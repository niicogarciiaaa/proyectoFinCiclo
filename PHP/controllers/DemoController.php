<?php
require_once __DIR__ . '/../models/Demo.php';

/** Controlador del modo demostración (solo rol Taller, sobre su propio taller). */
class DemoController {
    private $model;
    private $userId;
    private $workshop = null;

    public function __construct($db, $userId, $userRole) {
        $this->model = new DemoModel($db);
        $this->userId = (int)$userId;
        if ($userRole === 'Taller') {
            $this->workshop = $this->model->getWorkshop($this->userId);
        }
    }

    public function estado() {
        if (!$this->requireWorkshop()) return;
        $this->sendResponse(200, true, "", ['demo' => $this->model->contar((int)$this->workshop['WorkshopID'])]);
    }

    public function crear() {
        if (!$this->requireWorkshop()) return;
        $wid = (int)$this->workshop['WorkshopID'];
        if ($this->model->contar($wid)['Clientes'] > 0) {
            return $this->sendResponse(409, false, "Ya hay datos de demostración. Bórralos antes de volver a crearlos.");
        }
        $this->model->crear($wid, $this->userId);
        $this->sendResponse(200, true, "Datos de demostración creados", ['demo' => $this->model->contar($wid)]);
    }

    public function borrar() {
        if (!$this->requireWorkshop()) return;
        $wid = (int)$this->workshop['WorkshopID'];
        if ($this->model->rompeCadenaVerifactu($wid)) {
            return $this->sendResponse(409, false,
                "No se pueden borrar: hay facturas reales con VeriFactu registradas después de una factura de demostración y se rompería la cadena de huellas.");
        }
        $this->model->borrar($wid);
        $this->sendResponse(200, true, "Datos de demostración eliminados", ['demo' => $this->model->contar($wid)]);
    }

    private function requireWorkshop() {
        if (!$this->workshop) {
            $this->sendResponse(403, false, "Solo los talleres pueden usar el modo demostración");
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
