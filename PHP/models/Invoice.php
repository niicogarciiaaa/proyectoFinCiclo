<?php
class InvoiceModel {
    private $conn;
    private $table = 'Invoices';
    
    // Propiedades de la factura
    public $InvoiceID;
    public $AppointmentID;
    public $Date;
    public $TotalAmount;
    public $Estado;
    public $UserID;
    public $Items = [];
    
    public function __construct($db) {
        $this->conn = $db;
    }
    
    public function create() {
        try {
            $this->conn->begin_transaction();
            
            // Insertar factura principal
            $query = "INSERT INTO " . $this->table . " 
                     (AppointmentID, Date, TotalAmount, Estado, UserID) 
                     VALUES (?, ?, ?, ?, ?)";
            
            $stmt = $this->conn->prepare($query);
            $stmt->bind_param("isdsi", 
                $this->AppointmentID,
                $this->Date,
                $this->TotalAmount,
                $this->Estado,
                $this->UserID
            );
            
            if (!$stmt->execute()) {
                throw new Exception('Error al crear la factura');
            }
            
            $this->InvoiceID = $stmt->insert_id;
            
            // Insertar items de la factura
            foreach ($this->Items as $item) {
                $this->createInvoiceItem($item);
            }
            
            // Actualizar estado de la cita
            $this->updateAppointmentStatus();
            
            $this->conn->commit();
            return true;
            
        } catch (Exception $e) {
            $this->conn->rollback();
            throw $e;
        }
    }
    
    private function createInvoiceItem($item) {
        $query = "INSERT INTO InvoiceItems 
                 (InvoiceID, Description, Quantity, UnitPrice, TaxRate, Amount) 
                 VALUES (?, ?, ?, ?, ?, ?)";
                 
        $stmt = $this->conn->prepare($query);
        
        // Ya no necesitamos calcular el amount aquí porque viene calculado del controlador
        $stmt->bind_param("isdddd",
            $this->InvoiceID,
            $item['description'],
            $item['quantity'],
            $item['unit_price'],
            $item['tax_rate'],
            $item['amount']
        );
        
        if (!$stmt->execute()) {
            throw new Exception('Error al crear ítem de factura: ' . $stmt->error);
        }
    }
    
    public function getInvoices($userRole, $userId = null) {
        $query = $userRole === 'Taller' ? $this->getTallerQuery() : $this->getClientQuery();
        $stmt = $this->conn->prepare($query);
        
        if ($userRole !== 'Taller') {
            $stmt->bind_param("i", $userId);
        }
        
        $stmt->execute();
        $result = $stmt->get_result();
        $invoices = [];
        
        while ($invoice = $result->fetch_assoc()) {
            $invoice['items'] = $this->getInvoiceItems($invoice['InvoiceID']);
            $invoices[] = $invoice;
        }
        
        return $invoices;
    }
    
    private function getInvoiceItems($invoiceId) {
        $query = "SELECT ItemID, Description, Quantity, UnitPrice, TaxRate, Amount 
                 FROM InvoiceItems WHERE InvoiceID = ?";
        
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param("i", $invoiceId);
        $stmt->execute();
        
        return $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    }
    
    private function updateAppointmentStatus() {
        $query = "UPDATE Appointments SET Status = 'Finalizada' 
                 WHERE AppointmentID = ?"; // Actualizado de Estado a Status
                 
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param("i", $this->AppointmentID);
        
        if (!$stmt->execute()) {
            throw new Exception('Error al actualizar el estado de la cita');
        }
    }
    
    private function getTallerQuery() {
        return "SELECT 
                i.InvoiceID, i.AppointmentID, i.Date, i.TotalAmount, i.Estado,
                u.FullName AS UserName,
                a.VehicleID,
                v.Modelo, v.Anyo,
                w.WorkshopID, w.Name AS WorkshopName,
                w.Address AS WorkshopAddress, w.Phone AS WorkshopPhone,
                a.StartDateTime, -- Actualizado
                a.Service, -- Actualizado
                a.Status -- Actualizado
            FROM " . $this->table . " i
            JOIN Appointments a ON i.AppointmentID = a.AppointmentID
            JOIN Users u ON a.UserID = u.UserID
            LEFT JOIN Vehicles v ON a.VehicleID = v.VehicleID
            LEFT JOIN Workshops w ON a.WorkshopID = w.WorkshopID
            ORDER BY i.Date DESC";
    }
    
    private function getClientQuery() {
        return "SELECT 
                i.InvoiceID, i.AppointmentID, i.Date, i.TotalAmount, i.Estado,
                a.VehicleID,
                v.Marca, v.Modelo, v.Anyo,
                w.WorkshopID, w.Name AS WorkshopName,
                w.Address AS WorkshopAddress, w.Phone AS WorkshopPhone
            FROM " . $this->table . " i
            JOIN Appointments a ON i.AppointmentID = a.AppointmentID
            LEFT JOIN Vehicles v ON a.VehicleID = v.VehicleID
            LEFT JOIN Workshops w ON a.WorkshopID = w.WorkshopID
            WHERE a.UserID = ?
            ORDER BY i.Date DESC";
    }

    /**
     * Obtiene estadísticas de facturación por período
     */
    public function getInvoiceStats($startDate, $endDate, $userRole, $userId = null) {
        $query = "SELECT 
                    COUNT(*) as total_facturas,
                    COALESCE(SUM(TotalAmount), 0) as total_facturado,
                    COALESCE(AVG(TotalAmount), 0) as promedio_factura,
                    SUM(CASE WHEN i.Estado = 'Pendiente' THEN 1 ELSE 0 END) as pendientes,
                    SUM(CASE WHEN i.Estado = 'Pagado' THEN 1 ELSE 0 END) as pagadas
                 FROM " . $this->table . " i
                 JOIN Appointments a ON i.AppointmentID = a.AppointmentID
                 WHERE i.Date BETWEEN ? AND ?";
                 
        if ($userRole !== 'Taller') {
            $query .= " AND a.UserID = ?";
        }
        
        // Añadir GROUP BY para asegurar que las agregaciones son correctas
        $query .= " GROUP BY NULL";
        
        $stmt = $this->conn->prepare($query);
        
        if ($userRole !== 'Taller') {
            $stmt->bind_param("ssi", $startDate, $endDate, $userId);
        } else {
            $stmt->bind_param("ss", $startDate, $endDate);
        }
        
        $stmt->execute();
        $result = $stmt->get_result()->fetch_assoc();
        
        // Asegurar que los valores nulos se convierten a 0
        return array_map(function($value) {
            return $value === null ? 0 : $value;
        }, $result);
    }

    /**
     * Busca facturas por período y estado
     */
    public function searchInvoices($startDate, $endDate, $estado = null, $userRole, $userId = null) {
        $baseQuery = $userRole === 'Taller' ? $this->getTallerQuery() : $this->getClientQuery();
        // Eliminar "ORDER BY" de la consulta base para añadirlo al final
        $baseQuery = preg_replace('/ORDER BY.*$/', '', $baseQuery);
        
        // Añadir condiciones WHERE/AND según corresponda
        if (strpos($baseQuery, 'WHERE') !== false) {
            $query = $baseQuery . " AND i.Date BETWEEN ? AND ?";
        } else {
            $query = $baseQuery . " WHERE i.Date BETWEEN ? AND ?";
        }
        
        if ($estado) {
            $query .= " AND i.Estado = ?";
        }
        
        // Añadir ORDER BY al final
        $query .= " ORDER BY i.Date DESC";
        
        $stmt = $this->conn->prepare($query);
        
        if ($userRole !== 'Taller') {
            if ($estado) {
                $stmt->bind_param("isss", $userId, $startDate, $endDate, $estado);
            } else {
                $stmt->bind_param("iss", $userId, $startDate, $endDate);
            }
        } else {
            if ($estado) {
                $stmt->bind_param("sss", $startDate, $endDate, $estado);
            } else {
                $stmt->bind_param("ss", $startDate, $endDate);
            }
        }
        
        $stmt->execute();
        $result = $stmt->get_result();
        $invoices = [];
        
        while ($invoice = $result->fetch_assoc()) {
            $invoice['items'] = $this->getInvoiceItems($invoice['InvoiceID']);
            $invoices[] = $invoice;
        }
        
        return $invoices;
    }
}
?>