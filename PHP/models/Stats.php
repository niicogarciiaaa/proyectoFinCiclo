<?php
/**
 * Modelo del dashboard de estadísticas ampliado del taller (llamada nueva).
 * Solo lectura sobre Invoices y Appointments.
 */
class StatsModel {
    private $conn;

    /** Formatos de agrupación permitidos (lista blanca, nunca texto del cliente). */
    private const AGRUPACIONES = [
        'dia'    => '%Y-%m-%d',
        'semana' => '%x-S%v',
        'mes'    => '%Y-%m',
    ];

    public function __construct($db) {
        $this->conn = $db;
    }

    public function getWorkshopIdByUserId($userId) {
        $stmt = $this->conn->prepare("SELECT WorkshopID FROM Workshops WHERE UserID = ?");
        $stmt->bind_param("i", $userId);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        return $row ? (int)$row['WorkshopID'] : null;
    }

    /** Ingresos facturados agrupados por día, semana o mes. */
    public function ingresosPorPeriodo($workshopId, $start, $end, $agrupacion) {
        $formato = self::AGRUPACIONES[$agrupacion] ?? self::AGRUPACIONES['mes'];
        $query = "SELECT DATE_FORMAT(i.Date, '$formato') AS Periodo,
                         COUNT(*) AS Facturas,
                         SUM(i.TotalAmount) AS Total,
                         SUM(CASE WHEN i.Estado = 'Pagado' THEN i.TotalAmount ELSE 0 END) AS Cobrado
                  FROM Invoices i
                  JOIN Appointments a ON a.AppointmentID = i.AppointmentID
                  WHERE a.WorkshopID = ? AND i.Date BETWEEN ? AND ?
                  GROUP BY Periodo
                  ORDER BY Periodo";
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param("iss", $workshopId, $start, $end);
        $stmt->execute();
        $result = $stmt->get_result();
        $rows = [];
        while ($row = $result->fetch_assoc()) {
            $rows[] = [
                'Periodo'  => $row['Periodo'],
                'Facturas' => (int)$row['Facturas'],
                'Total'    => round((float)$row['Total'], 2),
                'Cobrado'  => round((float)$row['Cobrado'], 2),
            ];
        }
        return $rows;
    }

    /** Servicios más demandados en el periodo (citas no canceladas). */
    public function topServicios($workshopId, $start, $end, $limit = 8) {
        $limit = max(1, min(50, (int)$limit));
        $query = "SELECT a.Service AS Servicio,
                         COUNT(*) AS Citas,
                         COALESCE(SUM(i.TotalAmount), 0) AS Facturado
                  FROM Appointments a
                  LEFT JOIN Invoices i ON i.InvoiceID = (
                      SELECT MAX(i2.InvoiceID) FROM Invoices i2 WHERE i2.AppointmentID = a.AppointmentID
                  )
                  WHERE a.WorkshopID = ?
                    AND a.Status <> 'Cancelada'
                    AND DATE(a.StartDateTime) BETWEEN ? AND ?
                  GROUP BY a.Service
                  ORDER BY Citas DESC, Facturado DESC
                  LIMIT ?";
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param("issi", $workshopId, $start, $end, $limit);
        $stmt->execute();
        $result = $stmt->get_result();
        $rows = [];
        while ($row = $result->fetch_assoc()) {
            $rows[] = [
                'Servicio'  => $row['Servicio'],
                'Citas'     => (int)$row['Citas'],
                'Facturado' => round((float)$row['Facturado'], 2),
            ];
        }
        return $rows;
    }

    /** Número de citas por estado en el periodo. */
    public function citasPorEstado($workshopId, $start, $end) {
        $query = "SELECT Status, COUNT(*) AS Total
                  FROM Appointments
                  WHERE WorkshopID = ? AND DATE(StartDateTime) BETWEEN ? AND ?
                  GROUP BY Status";
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param("iss", $workshopId, $start, $end);
        $stmt->execute();
        $result = $stmt->get_result();
        $estados = ['Pendiente' => 0, 'Confirmada' => 0, 'Finalizada' => 0, 'Cancelada' => 0];
        while ($row = $result->fetch_assoc()) {
            $estados[$row['Status']] = (int)$row['Total'];
        }
        return $estados;
    }

    /** Indicadores globales del periodo: clientes únicos y ticket medio. */
    public function indicadores($workshopId, $start, $end) {
        $query = "SELECT COUNT(DISTINCT a.UserID) AS Clientes,
                         COUNT(i.InvoiceID) AS Facturas,
                         COALESCE(SUM(i.TotalAmount), 0) AS Total,
                         COALESCE(SUM(CASE WHEN i.Estado = 'Pendiente' THEN i.TotalAmount ELSE 0 END), 0) AS PendienteCobro
                  FROM Appointments a
                  LEFT JOIN Invoices i ON i.AppointmentID = a.AppointmentID
                  WHERE a.WorkshopID = ? AND DATE(a.StartDateTime) BETWEEN ? AND ?
                    AND a.Status <> 'Cancelada'";
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param("iss", $workshopId, $start, $end);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $facturas = (int)$row['Facturas'];
        $total = (float)$row['Total'];
        return [
            'Clientes'       => (int)$row['Clientes'],
            'Facturas'       => $facturas,
            'Total'          => round($total, 2),
            'TicketMedio'    => $facturas > 0 ? round($total / $facturas, 2) : 0,
            'PendienteCobro' => round((float)$row['PendienteCobro'], 2),
        ];
    }
}
?>
