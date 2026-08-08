<?php
require_once __DIR__ . '/../models/Workshop.php';

class WorkshopController {
    private $model;
    private $userId;
    private $userRole;
    private $conn;
    
    public function __construct($db, $userId, $userRole) {
        $this->model = new Workshop($db);
        $this->userId = $userId;
        $this->userRole = $userRole;
        $this->conn = $db;
    }
    
    public function createWorkshop($data) {
        try {
            // Verificar que el usuario es administrador
            if ($this->userRole !== 'Administrador') {
                return $this->sendResponse(403, false, "No autorizado. Solo los administradores pueden crear talleres.");
            }
            
            // Validar datos requeridos
            $requiredFields = ['email', 'fullName', 'password', 'workshopName', 'address', 'phone'];
            foreach ($requiredFields as $field) {
                if (!isset($data[$field]) || empty(trim($data[$field]))) {
                    return $this->sendResponse(400, false, "El campo {$field} es requerido");
                }
            }
            
            // Crear cuenta de usuario del taller
            $hashedPassword = password_hash($data['password'], PASSWORD_DEFAULT);
            $stmt = $this->conn->prepare("INSERT INTO Users (Email, FullName, Password, Role) VALUES (?, ?, ?, 'Taller')");
            $stmt->bind_param("sss", $data['email'], $data['fullName'], $hashedPassword);
            
            if (!$stmt->execute()) {
                return $this->sendResponse(500, false, "Error al crear la cuenta de usuario del taller");
            }

            $userId = $this->conn->insert_id;

            // Crear el registro del taller
            $description = isset($data['description']) ? $data['description'] : '';
            $stmt = $this->conn->prepare("INSERT INTO Workshops (UserID, Name, Address, Phone, Description) VALUES (?, ?, ?, ?, ?)");
            $stmt->bind_param("issss", $userId, $data['workshopName'], $data['address'], $data['phone'], $description);
            
            if (!$stmt->execute()) {
                // Rollback - eliminar usuario creado si falla la creación del taller
                $this->conn->query("DELETE FROM Users WHERE UserID = $userId");
                return $this->sendResponse(500, false, "Error al crear la información del taller");
            }
            
            $workshopId = $this->conn->insert_id;
            
            return $this->sendResponse(201, true, "Taller creado correctamente", [
                'userId' => $workshopId
            ]);
            
        } catch (Exception $e) {
            return $this->sendResponse(500, false, "Error: " . $e->getMessage());
        }
    }
    
    public function updateWorkshop($data) {
        try {
            if ($this->userRole !== 'Administrador') {
                return $this->sendResponse(403, false, "No autorizado. Solo los administradores pueden actualizar talleres.");
            }
            
            if (!isset($data['workshopId'])) {
                return $this->sendResponse(400, false, "ID del taller es requerido");
            }
            
            $stmt = $this->conn->prepare("UPDATE Workshops SET Name = ?, Address = ?, Phone = ?, Description = ? WHERE WorkshopID = ?");
            $stmt->bind_param("ssssi", $data['Name'], $data['Address'], $data['Phone'], $data['Description'], $data['WorkshopID']);
            
            if (!$stmt->execute()) {
                return $this->sendResponse(500, false, "Error al actualizar la información del taller");
            }

            return $this->sendResponse(200, true, "Información del taller actualizada correctamente");
            
        } catch (Exception $e) {
            return $this->sendResponse(500, false, "Error: " . $e->getMessage());
        }
    }    public function getAllWorkshops() {
        try {
            if ($this->userRole !== 'Administrador') {
                return $this->sendResponse(403, false, "No autorizado");
            }

            $query = "SELECT w.WorkshopID, w.UserID, w.Name, w.Address, w.Phone, w.Description, 
                             w.CreateAt, u.Email, u.FullName
                      FROM Workshops w
                      INNER JOIN Users u ON w.UserID = u.UserID";
            
            $result = $this->model->query($query);
            
            if (!$result) {
                throw new Exception("Error al obtener los talleres");
            }
            
            $workshops = [];
            while ($row = $result->fetch_assoc()) {
                $workshops[] = $row;
            }
            
            return $this->sendResponse(200, true, "", ['workshops' => $workshops]);
            
        } catch (Exception $e) {
            return $this->sendResponse(500, false, "Error: " . $e->getMessage());
        }
    }

    public function getWorkshopById($id) {
        try {
            if ($this->userRole !== 'Administrador') {
                return $this->sendResponse(403, false, "No autorizado");
            }            $query = "SELECT w.*, u.Email, u.FullName 
                     FROM Workshops w
                     INNER JOIN Users u ON w.UserID = u.UserID
                     WHERE w.WorkshopID = ?";
            
            $result = $this->model->getById($id);
            
            if ($result->num_rows === 0) {
                return $this->sendResponse(404, false, "Taller no encontrado");
            }
            
            return $this->sendResponse(200, true, "", ['workshop' => $result->fetch_assoc()]);
            
        } catch (Exception $e) {
            return $this->sendResponse(500, false, "Error: " . $e->getMessage());
        }
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
