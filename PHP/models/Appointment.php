<?php
class AppointmentModel {
    private $conn;
    private $table = 'Appointments';
    
    // Propiedades de la cita
    public $AppointmentID;
    public $UserID;
    public $VehicleID;
    public $WorkshopID;
    public $StartDateTime;
    public $EndDateTime;
    public $Descripcion;
    public $Status;
    
    // Constructor con conexión a la base de datos
    public function __construct($db) {
        $this->conn = $db;
    }
    
    // Método para obtener el taller asociado a un usuario
    public function getWorkshopByUserId($userId) {
        $query = "SELECT WorkshopID FROM Workshops WHERE UserID = ?";
        
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param("i", $userId);
        $stmt->execute();
        
        return $stmt->get_result();
    }
    
    // Método para obtener slots semanales
    public function getWeeklySlots($workshopId, $startDate, $endDate) {
        $query = "SELECT StartDateTime 
                 FROM " . $this->table . " 
                 WHERE WorkshopID = ? 
                 AND DATE(StartDateTime) BETWEEN ? AND ? 
                 AND DAYOFWEEK(StartDateTime) BETWEEN 2 AND 6";
                 
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param("iss", $workshopId, $startDate, $endDate);
        $stmt->execute();
        
        return $stmt->get_result();
    }
    
    // Método para obtener slots diarios
    public function getDaySlots($workshopId, $date) {
        $query = "SELECT StartDateTime 
                 FROM " . $this->table . " 
                 WHERE WorkshopID = ? 
                 AND DATE(StartDateTime) = ?";
                 
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param("is", $workshopId, $date);
        $stmt->execute();
        
        return $stmt->get_result();
    }
    
    // Método para verificar si existe un taller
    public function checkWorkshopExists($workshopId) {
        $query = "SELECT WorkshopID FROM Workshops WHERE WorkshopID = ?";
        
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param("i", $workshopId);
        $stmt->execute();
        
        return $stmt->get_result()->num_rows > 0;
    }
    
    // Método para crear una nueva cita
    public function create() {
        $query = "INSERT INTO " . $this->table . " 
                 (UserID, VehicleID, WorkshopID, StartDateTime, EndDateTime, Description, Status) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)";
        
        $stmt = $this->conn->prepare($query);
        
        // Limpiar y sanitizar los datos
        $this->Descripcion = htmlspecialchars(strip_tags($this->Descripcion));
        $this->Status = htmlspecialchars(strip_tags($this->Status));
        
        // Vincular los parámetros
        $stmt->bind_param("iiissss",
            $this->UserID,
            $this->VehicleID,
            $this->WorkshopID,
            $this->StartDateTime,
            $this->EndDateTime,
            $this->Descripcion,
            $this->Status
        );
        
        return $stmt->execute();
    }
    
    // Método para obtener todas las citas de un taller
    public function getWorkshopAppointments($workshopId) {
        $query = "SELECT 
                    a.AppointmentID, 
                    a.StartDateTime, 
                    a.EndDateTime, 
                    CONCAT(v.Marca, ' ', v.Modelo) AS Vehiculo, 
                    a.Description,	 
                    a.Status, 
                    u.FullName AS UserName 
                FROM " . $this->table . " a
                JOIN Vehicles v ON a.VehicleID = v.VehicleID 
                JOIN Users u ON v.UserID = u.UserID 
                WHERE a.WorkshopID = ?";
                
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param("i", $workshopId);
        $stmt->execute();
        
        return $stmt->get_result();
    }
    
    // Método para verificar disponibilidad de slot
    public function checkSlotAvailability($workshopId, $startDateTime) {
        $query = "SELECT AppointmentID 
                 FROM " . $this->table . " 
                 WHERE WorkshopID = ? 
                 AND StartDateTime = ?";
                 
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param("is", $workshopId, $startDateTime);
        $stmt->execute();
        
        return $stmt->get_result()->num_rows === 0;
    }
    
    // Método para obtener el nombre del taller
    public function getWorkshopName($workshopId) {
        $stmt = $this->conn->prepare("SELECT Name FROM Workshops WHERE WorkshopID = ?");
        $stmt->bind_param("i", $workshopId);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($row = $result->fetch_assoc()) {
            return $row['Name'];
        }
        return "Taller no encontrado";
    }

    
}
?>