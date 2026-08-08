<?php
class Vehicle {
    private $conn;
    private $table = 'Vehicles';
    
    // Propiedades del vehículo
    public $VehicleID;
    public $UserID;
    public $marca;
    public $modelo;
    public $anyo;
    public $matricula;
    
    // Constructor con conexión a la base de datos
    public function __construct($db) {
        $this->conn = $db;
    }
    
    // Método para obtener todos los vehículos de un usuario
    public function getVehiclesByUser($user_id) {
        $query = "SELECT VehicleID, UserID, marca, modelo, anyo, matricula 
                 FROM " . $this->table . " 
                 WHERE UserID = ?";
        
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param("i", $user_id);
        $stmt->execute();
        
        return $stmt;
    }
    
    // Método para obtener un vehículo específico por ID
    public function getVehicleById($vehicle_id) {
        $query = "SELECT VehicleID, UserID, marca, modelo, anyo, matricula 
                 FROM " . $this->table . " 
                 WHERE VehicleID = ?";
        
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param("i", $vehicle_id);
        $stmt->execute();
        
        return $stmt;
    }
    
    // Método para crear un nuevo vehículo
    public function create() {
        $query = "INSERT INTO " . $this->table . " 
                 (UserID, marca, modelo, anyo, matricula) 
                 VALUES (?, ?, ?, ?, ?)";
        
        $stmt = $this->conn->prepare($query);
        
        // Limpiar y sanitizar los datos
        $this->UserID = htmlspecialchars(strip_tags($this->UserID));
        $this->marca = htmlspecialchars(strip_tags($this->marca));
        $this->modelo = htmlspecialchars(strip_tags($this->modelo));
        $this->anyo = htmlspecialchars(strip_tags($this->anyo));
        $this->matricula = htmlspecialchars(strip_tags($this->matricula));
        
        // Vincular los parámetros
        $stmt->bind_param("issss", 
            $this->UserID, 
            $this->marca, 
            $this->modelo, 
            $this->anyo, 
            $this->matricula
        );
        
        // Ejecutar la consulta
        if($stmt->execute()) {
            return true;
        }
        
        return false;
    }
    
    // Método para eliminar un vehículo
    public function delete($vehicle_id, $user_id) {
        // Primero verificar que el vehículo pertenece al usuario
        $checkQuery = "SELECT UserID FROM " . $this->table . " WHERE VehicleID = ?";
        $checkStmt = $this->conn->prepare($checkQuery);
        $checkStmt->bind_param("i", $vehicle_id);
        $checkStmt->execute();
        $result = $checkStmt->get_result();
        
        if($result->num_rows === 0) {
            return false; // El vehículo no existe
        }
        
        $row = $result->fetch_assoc();
        if($row['UserID'] != $user_id) {
            return false; // El vehículo no pertenece al usuario
        }
        
        // Si todo está correcto, eliminar el vehículo
        $query = "DELETE FROM " . $this->table . " WHERE VehicleID = ?";
        $stmt = $this->conn->prepare($query);
        $stmt->bind_param("i", $vehicle_id);
        
        if($stmt->execute()) {
            return true;
        }
        
        return false;
    }
    
    // Método para actualizar un vehículo
    public function update() {
        $query = "UPDATE " . $this->table . "
                SET
                    marca = ?,
                    modelo = ?,
                    anyo = ?,
                    matricula = ?
                WHERE
                    VehicleID = ? AND UserID = ?";
        
        $stmt = $this->conn->prepare($query);
        
        // Limpiar y sanitizar los datos
        $this->marca = htmlspecialchars(strip_tags($this->marca));
        $this->modelo = htmlspecialchars(strip_tags($this->modelo));
        $this->anyo = htmlspecialchars(strip_tags($this->anyo));
        $this->matricula = htmlspecialchars(strip_tags($this->matricula));
        $this->VehicleID = htmlspecialchars(strip_tags($this->VehicleID));
        $this->UserID = htmlspecialchars(strip_tags($this->UserID));
        
        // Vincular los parámetros
        $stmt->bind_param("sssiii",
            $this->marca,
            $this->modelo,
            $this->anyo,
            $this->matricula,
            $this->VehicleID,
            $this->UserID
        );
        
        // Ejecutar la consulta
        if($stmt->execute()) {
            return true;
        }
        
        return false;
    }
}
?>