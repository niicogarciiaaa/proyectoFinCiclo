<?php
require_once '../config/database.php';

class VehicleController {
    private $conn;
    
    public function __construct() {
        // Crear conexión a la base de datos
        $db = new Database();
        $this->conn = $db->getConnection();
    }
    
    // Método para crear un nuevo vehículo
    public function createVehicle($user_id, $marca, $modelo, $anyo, $matricula) {
        // Validar datos
        if (empty($marca) || empty($modelo) || empty($anyo) || empty($matricula)) {
            return [
                "success" => false, 
                "message" => "Todos los campos son requeridos"
            ];
        }
        
        // Insertar vehículo en la base de datos
        $stmt = $this->conn->prepare("INSERT INTO Vehicles (UserID, marca, modelo, anyo, matricula) VALUES (?, ?, ?, ?, ?)");
        if (!$stmt) {
            return [
                "success" => false, 
                "message" => "Error en la preparación de la consulta"
            ];
        }
        
        $stmt->bind_param("issss", $user_id, $marca, $modelo, $anyo, $matricula);
        
        if (!$stmt->execute()) {
            return [
                "success" => false, 
                "message" => "Error al insertar el vehículo"
            ];
        }
        
        $vehicleID = $this->conn->insert_id;
        $stmt->close();
        
        return [
            "success" => true, 
            "message" => "Vehículo creado con éxito",
            "vehicleID" => $vehicleID
        ];
    }
    
    // Método para obtener todos los vehículos de un usuario
    public function getVehicles($user_id) {
        $stmt = $this->conn->prepare("SELECT VehicleID, UserID, marca, modelo, anyo, matricula FROM Vehicles WHERE UserID = ?");
        if (!$stmt) {
            return [
                "success" => false, 
                "message" => "Error en la preparación de la consulta"
            ];
        }
        
        $stmt->bind_param("i", $user_id);
        
        if (!$stmt->execute()) {
            return [
                "success" => false, 
                "message" => "Error al ejecutar la consulta"
            ];
        }
        
        $result = $stmt->get_result();
        $vehicles = [];
        
        while ($row = $result->fetch_assoc()) {
            $vehicles[] = $row;
        }
        
        $stmt->close();
        
        return [
            "success" => true, 
            "vehicles" => $vehicles
        ];
    }
    
    // Método para obtener los detalles de un vehículo específico
    public function getVehicleDetails($vehiculoID) {
        if (!$vehiculoID) {
            return [
                "success" => false, 
                "message" => "ID de vehículo no proporcionado"
            ];
        }
        
        $stmt = $this->conn->prepare("SELECT VehicleID, UserID, marca, modelo, anyo, matricula FROM Vehicles WHERE VehicleID = ?");
        if (!$stmt) {
            return [
                "success" => false, 
                "message" => "Error en la preparación de la consulta"
            ];
        }
        
        $stmt->bind_param("i", $vehiculoID);
        
        if (!$stmt->execute()) {
            return [
                "success" => false, 
                "message" => "Error al ejecutar la consulta"
            ];
        }
        
        $result = $stmt->get_result();
        
        if ($result->num_rows === 0) {
            return [
                "success" => false, 
                "message" => "Vehículo no encontrado"
            ];
        }
        
        $vehicle = $result->fetch_assoc();
        $stmt->close();
        
        return [
            "success" => true,
            "vehicle" => $vehicle
        ];
    }
    
    // Método para eliminar un vehículo
    public function deleteVehicle($user_id, $vehiculoID) {
        if (!$vehiculoID) {
            return [
                "success" => false, 
                "message" => "ID de vehículo no proporcionado"
            ];
        }
        
        // Verificar si el vehículo existe y pertenece al usuario
        $stmt = $this->conn->prepare("SELECT VehicleID, UserID FROM Vehicles WHERE VehicleID = ?");
        if (!$stmt) {
            return [
                "success" => false, 
                "message" => "Error en la preparación de la consulta"
            ];
        }
        
        $stmt->bind_param("i", $vehiculoID);
        
        if (!$stmt->execute()) {
            return [
                "success" => false, 
                "message" => "Error al ejecutar la consulta"
            ];
        }
        
        $result = $stmt->get_result();
        
        if ($result->num_rows === 0) {
            return [
                "success" => false, 
                "message" => "Vehículo no encontrado"
            ];
        }
        
        $vehicle = $result->fetch_assoc();
        
        // Verificar que el vehículo pertenece al usuario
        if ($vehicle['UserID'] != $user_id) {
            return [
                "success" => false, 
                "message" => "No tienes permiso para eliminar este vehículo"
            ];
        }
        
        // Eliminar el vehículo
        $stmt = $this->conn->prepare("DELETE FROM Vehicles WHERE VehicleID = ?");
        if (!$stmt) {
            return [
                "success" => false, 
                "message" => "Error en la preparación de la consulta para eliminar"
            ];
        }
        
        $stmt->bind_param("i", $vehiculoID);
        
        if (!$stmt->execute()) {
            return [
                "success" => false, 
                "message" => "Error al eliminar el vehículo"
            ];
        }
        
        $stmt->close();
        
        return [
            "success" => true, 
            "message" => "Vehículo eliminado con éxito"
        ];
    }
}
?>