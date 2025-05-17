
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
        
        $amount = $item['quantity'] * $item['unit_price'] * (1 + $item['tax_rate'] / 100);
        
        $stmt->bind_param("isdddd",
            $this->InvoiceID,
            $item['description'],
            $item['quantity'],
            $item['unit_price'],
            $item['tax_rate'],
            $amount
        );
        
        if (!$stmt->execute()) {
            throw new Exception('Error al crear ítem de factura');
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
                 WHERE AppointmentID = ?";
                 
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
                w.Address AS WorkshopAddress, w.Phone AS WorkshopPhone
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
}
?><?php
// Invoice.php contenido ejemplo para MVC
