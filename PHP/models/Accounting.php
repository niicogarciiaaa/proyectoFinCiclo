<?php
/**
 * Modelo de la exportación contable para el gestor (llamada nueva).
 * Solo lectura sobre Invoices, InvoiceItems, Appointments y, si existen,
 * las tablas de VeriFactu.
 */
class AccountingModel {
    private $conn;

    public function __construct($db) {
        $this->conn = $db;
    }

    public function getWorkshop($userId) {
        $stmt = $this->conn->prepare("SELECT WorkshopID, Name, Address, Phone FROM Workshops WHERE UserID = ?");
        $stmt->bind_param("i", $userId);
        $stmt->execute();
        return $stmt->get_result()->fetch_assoc() ?: null;
    }

    /** Datos fiscales del taller (VeriFactu), si están configurados. */
    public function getEmisor($workshopId) {
        try {
            $stmt = $this->conn->prepare("SELECT NIF, RazonSocial FROM VerifactuEmisor WHERE WorkshopID = ?");
            $stmt->bind_param("i", $workshopId);
            $stmt->execute();
            return $stmt->get_result()->fetch_assoc() ?: null;
        } catch (Throwable $e) {
            return null; // La tabla de VeriFactu todavía no existe
        }
    }

    /** Facturas del taller entre dos fechas, con cliente y vehículo. */
    public function getInvoices($workshopId, $start, $end) {
        $stmt = $this->conn->prepare(
            "SELECT i.InvoiceID, i.Date, i.Estado, i.TotalAmount,
                    u.FullName AS Cliente, u.Email,
                    CONCAT(v.Marca, ' ', v.Modelo) AS Vehiculo, v.Matricula
             FROM Invoices i
             JOIN Appointments a ON a.AppointmentID = i.AppointmentID
             JOIN Users u ON u.UserID = i.UserID
             LEFT JOIN Vehicles v ON v.VehicleID = a.VehicleID
             WHERE a.WorkshopID = ? AND i.Date BETWEEN ? AND ?
             ORDER BY i.Date ASC, i.InvoiceID ASC"
        );
        $stmt->bind_param("iss", $workshopId, $start, $end);
        $stmt->execute();
        $result = $stmt->get_result();
        $rows = [];
        while ($row = $result->fetch_assoc()) {
            $rows[(int)$row['InvoiceID']] = $row;
        }
        return $rows;
    }

    /** Base imponible por factura y tipo de IVA. */
    public function getTaxBreakdown($invoiceIds) {
        if (!$invoiceIds) return [];
        $marcas = implode(',', array_fill(0, count($invoiceIds), '?'));
        $stmt = $this->conn->prepare(
            "SELECT InvoiceID, TaxRate, SUM(Quantity * UnitPrice) AS Base
             FROM InvoiceItems
             WHERE InvoiceID IN ($marcas)
             GROUP BY InvoiceID, TaxRate
             ORDER BY InvoiceID, TaxRate DESC"
        );
        $tipos = str_repeat('i', count($invoiceIds));
        $stmt->bind_param($tipos, ...$invoiceIds);
        $stmt->execute();
        $result = $stmt->get_result();
        $rows = [];
        while ($row = $result->fetch_assoc()) {
            $rows[(int)$row['InvoiceID']][] = [
                'Tipo' => (float)$row['TaxRate'],
                'Base' => (float)$row['Base'],
            ];
        }
        return $rows;
    }

    /** Nº de serie VeriFactu de cada factura que lo tenga. */
    public function getVerifactuNumbers($invoiceIds) {
        if (!$invoiceIds) return [];
        try {
            $marcas = implode(',', array_fill(0, count($invoiceIds), '?'));
            $stmt = $this->conn->prepare(
                "SELECT InvoiceID, NumSerieFactura FROM VerifactuRegistros WHERE InvoiceID IN ($marcas)"
            );
            $tipos = str_repeat('i', count($invoiceIds));
            $stmt->bind_param($tipos, ...$invoiceIds);
            $stmt->execute();
            $result = $stmt->get_result();
            $map = [];
            while ($row = $result->fetch_assoc()) {
                $map[(int)$row['InvoiceID']] = $row['NumSerieFactura'];
            }
            return $map;
        } catch (Throwable $e) {
            return []; // La tabla de VeriFactu todavía no existe
        }
    }
}
?>
