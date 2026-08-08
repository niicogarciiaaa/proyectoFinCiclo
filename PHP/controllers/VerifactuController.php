<?php
require_once __DIR__ . '/../models/Verifactu.php';

/**
 * Controlador VeriFactu.
 * Llamadas NUEVAS; no modifican la API de facturas existente. Trabajan en
 * solo lectura sobre las facturas y generan registros con huella encadenada.
 */
class VerifactuController {
    private $model;
    private $conn;
    private $userId;
    private $userRole;

    public function __construct($db, $userId, $userRole) {
        $this->model    = new VerifactuModel($db);
        $this->conn     = $db;
        $this->userId   = $userId;
        $this->userRole = $userRole;
    }

    // ---------- Emisor ----------

    public function obtenerEmisor() {
        $workshopId = $this->requireOwnWorkshop();
        if ($workshopId === null) return;
        $emisor = $this->model->getEmisor($workshopId);
        $this->sendResponse(200, true, "", ['emisor' => $emisor]);
    }

    public function guardarEmisor($data) {
        $workshopId = $this->requireOwnWorkshop();
        if ($workshopId === null) return;

        if (empty($data['NIF']) || empty($data['RazonSocial'])) {
            return $this->sendResponse(400, false, "NIF y razón social son obligatorios");
        }
        if (!$this->validarNif($data['NIF'])) {
            return $this->sendResponse(400, false, "El formato del NIF/CIF no es válido");
        }
        if ($this->model->saveEmisor($workshopId, $data['NIF'], $data['RazonSocial'])) {
            return $this->sendResponse(200, true, "Datos fiscales guardados correctamente");
        }
        return $this->sendResponse(500, false, "Error al guardar los datos fiscales");
    }

    // ---------- Registro VeriFactu ----------

    /** Genera (o devuelve si ya existe) el registro VeriFactu de una factura. */
    public function generar($data) {
        $workshopId = $this->requireOwnWorkshop();
        if ($workshopId === null) return;

        if (empty($data['InvoiceID'])) {
            return $this->sendResponse(400, false, "Falta el ID de la factura");
        }
        $invoiceId = (int)$data['InvoiceID'];

        // Idempotente: si ya tiene registro, se devuelve tal cual.
        $existente = $this->model->getRegistro($invoiceId);
        if ($existente) {
            return $this->sendResponse(200, true, "El registro ya existía", ['registro' => $existente, 'nuevo' => false]);
        }

        $inv = $this->model->getInvoiceData($invoiceId);
        if (!$inv) {
            return $this->sendResponse(404, false, "Factura no encontrada");
        }
        if ((int)$inv['WorkshopID'] !== $workshopId) {
            return $this->sendResponse(403, false, "Esa factura no pertenece a tu taller");
        }

        $emisor = $this->model->getEmisor($workshopId);
        if (!$emisor) {
            return $this->sendResponse(409, false, "Configura primero tus datos fiscales (NIF) para VeriFactu");
        }

        // Datos del registro de alta.
        $nif        = $emisor['NIF'];
        $numSerie   = 'AUTOCARE-' . $invoiceId;
        $fecha      = date('d-m-Y', strtotime($inv['Date']));
        $tipo       = 'F1';
        $cuota      = (float)$inv['CuotaTotal'];
        $importe    = (float)$inv['TotalAmount'];
        $huellaAnt  = $this->model->getUltimaHuella($workshopId);
        $fechaHora  = date('c'); // ISO-8601 con huso horario

        $huella = $this->model->calcularHuella(
            $nif, $numSerie, $fecha, $tipo, $cuota, $importe, $huellaAnt, $fechaHora
        );
        $qrUrl = $this->model->construirQrUrl($nif, $numSerie, $fecha, $importe);

        $registro = [
            'InvoiceID'            => $invoiceId,
            'WorkshopID'           => $workshopId,
            'NIF'                  => $nif,
            'NumSerieFactura'      => $numSerie,
            'FechaExpedicion'      => $fecha,
            'TipoFactura'          => $tipo,
            'CuotaTotal'           => $cuota,
            'ImporteTotal'         => $importe,
            'HuellaAnterior'       => $huellaAnt,
            'Huella'               => $huella,
            'FechaHoraGenRegistro' => $fechaHora,
            'QrUrl'                => $qrUrl,
        ];

        if (!$this->model->insertRegistro($registro)) {
            return $this->sendResponse(500, false, "Error al generar el registro VeriFactu");
        }
        $this->sendResponse(200, true, "Registro VeriFactu generado", ['registro' => $registro, 'nuevo' => true]);
    }

    /** Devuelve el registro VeriFactu de una factura (para el PDF/QR). */
    public function obtener($data) {
        if (empty($data['InvoiceID'])) {
            return $this->sendResponse(400, false, "Falta el ID de la factura");
        }
        $registro = $this->model->getRegistro((int)$data['InvoiceID']);
        if (!$registro) {
            return $this->sendResponse(404, false, "Esta factura aún no tiene registro VeriFactu");
        }
        $this->sendResponse(200, true, "", ['registro' => $registro]);
    }

    /** Recalcula y valida la integridad de la cadena de huellas del taller. */
    public function verificarCadena() {
        $workshopId = $this->requireOwnWorkshop();
        if ($workshopId === null) return;

        $res = $this->model->getRegistrosByWorkshop($workshopId);
        $anterior = '';
        $total = 0;
        $rota = null;
        while ($r = $res->fetch_assoc()) {
            $total++;
            $recalc = $this->model->calcularHuella(
                $r['NIF'], $r['NumSerieFactura'], $r['FechaExpedicion'], $r['TipoFactura'],
                (float)$r['CuotaTotal'], (float)$r['ImporteTotal'], $anterior, $r['FechaHoraGenRegistro']
            );
            if ($r['HuellaAnterior'] !== $anterior || $recalc !== $r['Huella']) {
                $rota = (int)$r['InvoiceID'];
                break;
            }
            $anterior = $r['Huella'];
        }

        $integra = ($rota === null);
        $this->sendResponse(200, true, "", [
            'integra'        => $integra,
            'total'          => $total,
            'rota_en_factura'=> $rota,
        ]);
    }

    // ---------- Helpers ----------

    private function requireOwnWorkshop() {
        if ($this->userRole !== 'Taller') {
            $this->sendResponse(403, false, "Solo los talleres pueden usar VeriFactu");
            return null;
        }
        $stmt = $this->conn->prepare("SELECT WorkshopID FROM Workshops WHERE UserID = ?");
        $stmt->bind_param("i", $this->userId);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        if (!$row) {
            $this->sendResponse(404, false, "No se encontró el taller asociado");
            return null;
        }
        return (int)$row['WorkshopID'];
    }

    /** Validación básica de formato de NIF/CIF/NIE español. */
    private function validarNif($nif) {
        $nif = strtoupper(trim($nif));
        return (bool)preg_match('/^[0-9A-Z][0-9]{7}[0-9A-Z]$/', $nif);
    }

    private function sendResponse($code, $success, $message, $data = []) {
        http_response_code($code);
        echo json_encode(array_merge(["success" => $success, "message" => $message], $data));
        return true;
    }
}
?>
