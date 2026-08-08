<?php
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/Logger.php';

configureCors();

$db = new Database();
$conn = $db->getConnection();

try {
    Logger::info("Consultando lista de talleres");
    $query = "SELECT w.WorkshopID, w.Name, w.Address, w.Phone, w.Description 
              FROM Workshops w";
    
    $result = $conn->query($query);
    
    if ($result) {
        $workshops = [];
        while ($row = $result->fetch_assoc()) {
            $workshops[] = $row;
        }
        
        Logger::info("Lista de talleres obtenida exitosamente", [
            'count' => count($workshops)
        ]);
        
        echo json_encode([
            'success' => true,
            'workshops' => $workshops
        ]);
    } else {
        throw new Exception("Error al obtener los talleres");
    }
} catch (Exception $e) {
    Logger::error("Error al consultar talleres: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
?>
