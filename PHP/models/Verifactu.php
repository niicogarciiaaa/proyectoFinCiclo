<?php
/**
 * Modelo VeriFactu (RD 1007/2023).
 *
 * Genera y almacena los registros de facturación con huella (hash SHA-256)
 * ENCADENADA por emisor: cada registro incorpora la huella del registro
 * anterior del mismo taller, de modo que la secuencia es a prueba de
 * manipulación. Calcula también la URL del QR de verificación de la AEAT.
 *
 * Todo es de solo lectura sobre las tablas existentes (Invoices, InvoiceItems,
 * Workshops): no modifica la API ni los datos originales.
 */
class VerifactuModel {
    private $conn;

    // URL del cotejo de QR de la AEAT (entorno de pruebas / preproducción).
    const QR_BASE = 'https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR';

    public function __construct($db) {
        $this->conn = $db;
    }

    // ---------- Emisor (datos fiscales del taller) ----------

    public function getEmisor($workshopId) {
        $stmt = $this->conn->prepare(
            "SELECT WorkshopID, NIF, RazonSocial FROM VerifactuEmisor WHERE WorkshopID = ?"
        );
        $stmt->bind_param("i", $workshopId);
        $stmt->execute();
        return $stmt->get_result()->fetch_assoc();
    }

    public function saveEmisor($workshopId, $nif, $razonSocial) {
        $query = "INSERT INTO VerifactuEmisor (WorkshopID, NIF, RazonSocial)
                  VALUES (?, ?, ?)
                  ON DUPLICATE KEY UPDATE NIF = VALUES(NIF), RazonSocial = VALUES(RazonSocial)";
        $nif = strtoupper(trim($nif));
        $razonSocial = htmlspecialchars(strip_tags($razonSocial));
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param("iss", $workshopId, $nif, $razonSocial);
        return $stmt->execute();
    }

    // ---------- Lectura de la factura (solo lectura) ----------

    /**
     * Devuelve los datos de una factura necesarios para VeriFactu, junto con
     * el WorkshopID del taller que la emite. Null si no existe.
     */
    public function getInvoiceData($invoiceId) {
        $query = "SELECT i.InvoiceID, i.Date, i.TotalAmount,
                         a.WorkshopID
                  FROM Invoices i
                  JOIN Appointments a ON i.AppointmentID = a.AppointmentID
                  WHERE i.InvoiceID = ?";
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param("i", $invoiceId);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        if (!$row) return null;

        // Cuota total de IVA = suma de (Amount - base) de los ítems.
        $stmt2 = $this->conn->prepare(
            "SELECT Quantity, UnitPrice, TaxRate FROM InvoiceItems WHERE InvoiceID = ?"
        );
        $stmt2->bind_param("i", $invoiceId);
        $stmt2->execute();
        $res = $stmt2->get_result();
        $cuota = 0.0;
        while ($it = $res->fetch_assoc()) {
            $base = (float)$it['Quantity'] * (float)$it['UnitPrice'];
            $cuota += $base * ((float)$it['TaxRate'] / 100);
        }
        $row['CuotaTotal'] = round($cuota, 2);
        return $row;
    }

    // ---------- Registros VeriFactu ----------

    public function getRegistro($invoiceId) {
        $stmt = $this->conn->prepare("SELECT * FROM VerifactuRegistros WHERE InvoiceID = ?");
        $stmt->bind_param("i", $invoiceId);
        $stmt->execute();
        return $stmt->get_result()->fetch_assoc();
    }

    /** Última huella registrada por el emisor (para encadenar). */
    public function getUltimaHuella($workshopId) {
        $stmt = $this->conn->prepare(
            "SELECT Huella FROM VerifactuRegistros WHERE WorkshopID = ? ORDER BY RegistroID DESC LIMIT 1"
        );
        $stmt->bind_param("i", $workshopId);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        return $row ? $row['Huella'] : '';
    }

    public function getRegistrosByWorkshop($workshopId) {
        $stmt = $this->conn->prepare(
            "SELECT * FROM VerifactuRegistros WHERE WorkshopID = ? ORDER BY RegistroID ASC"
        );
        $stmt->bind_param("i", $workshopId);
        $stmt->execute();
        return $stmt->get_result();
    }

    /**
     * Calcula la huella SHA-256 (hex mayúsculas) de un registro de alta según
     * el orden de campos de la especificación de la AEAT.
     */
    public function calcularHuella($nif, $numSerie, $fecha, $tipo, $cuota, $importe, $huellaAnterior, $fechaHora) {
        $cadena =
            'IDEmisorFactura=' . $nif .
            '&NumSerieFactura=' . $numSerie .
            '&FechaExpedicionFactura=' . $fecha .
            '&TipoFactura=' . $tipo .
            '&CuotaTotal=' . number_format($cuota, 2, '.', '') .
            '&ImporteTotal=' . number_format($importe, 2, '.', '') .
            '&Huella=' . $huellaAnterior .
            '&FechaHoraHusoGenRegistro=' . $fechaHora;
        return strtoupper(hash('sha256', $cadena));
    }

    /** Construye la URL del QR de verificación de la AEAT. */
    public function construirQrUrl($nif, $numSerie, $fecha, $importe) {
        $params = http_build_query([
            'nif'      => $nif,
            'numserie' => $numSerie,
            'fecha'    => $fecha,
            'importe'  => number_format($importe, 2, '.', ''),
        ]);
        return self::QR_BASE . '?' . $params;
    }

    public function insertRegistro($r) {
        $query = "INSERT INTO VerifactuRegistros
                    (InvoiceID, WorkshopID, NIF, NumSerieFactura, FechaExpedicion, TipoFactura,
                     CuotaTotal, ImporteTotal, HuellaAnterior, Huella, FechaHoraGenRegistro, QrUrl)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param(
            "iissssddssss",
            $r['InvoiceID'], $r['WorkshopID'], $r['NIF'], $r['NumSerieFactura'],
            $r['FechaExpedicion'], $r['TipoFactura'], $r['CuotaTotal'], $r['ImporteTotal'],
            $r['HuellaAnterior'], $r['Huella'], $r['FechaHoraGenRegistro'], $r['QrUrl']
        );
        return $stmt->execute();
    }
}
?>
