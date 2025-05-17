<?php
require_once __DIR__ . '/../models/Invoice.php';

class InvoiceController {
    private $model;
    private $userId;
    private $userRole;
    
    public function __construct($db, $userId, $userRole) {
        $this->model = new InvoiceModel($db);
        $this->userId = $userId;
        $this->userRole = $userRole;
    }
    
    public function crear($data) {
        try {
            if ($this->userRole !== 'Taller') {
                return $this->sendResponse(403, false, 
                    "No tienes permisos para crear facturas");
            }
            
            if (!$this->validarDatosFactura($data)) {
                return $this->sendResponse(400, false, 
                    "Faltan datos requeridos o son inválidos");
            }
            
            $this->model->AppointmentID = $data['appointment_id'];
            $this->model->Date = $data['date'] ?? date('Y-m-d');
            $this->model->Estado = $data['estado'] ?? 'Pendiente';
            $this->model->UserID = $this->userId;
            $this->model->Items = $data['items'];
            $this->model->TotalAmount = $this->calcularTotal($data['items']);
            
            if ($this->model->create()) {
                return $this->sendResponse(200, true, 
                    "Factura creada correctamente", 
                    ['invoice_id' => $this->model->InvoiceID]);
            }
            
        } catch (Exception $e) {
            return $this->sendResponse(500, false, $e->getMessage());
        }
    }
    
    public function listar() {
        try {
            $invoices = $this->model->getInvoices($this->userRole, $this->userId);
            return $this->sendResponse(200, true, "", ['invoices' => $invoices]);
        } catch (Exception $e) {
            return $this->sendResponse(500, false, $e->getMessage());
        }
    }
    
    private function validarDatosFactura($data) {
        return isset($data['appointment_id']) && 
               isset($data['items']) && 
               !empty($data['items']);
    }
    
    private function calcularTotal($items) {
        $total = 0;
        foreach ($items as $item) {
            $cantidad = floatval($item['quantity']);
            $precio = floatval($item['unit_price']);
            $iva = floatval($item['tax_rate']);
            $total += $cantidad * $precio * (1 + $iva / 100);
        }
        return $total;
    }
    
    private function sendResponse($code, $success, $message, $data = []) {
        http_response_code($code);
        echo json_encode(array_merge(
            ["success" => $success, "message" => $message],
            $data
        ));
        return true;
    }
}
?>