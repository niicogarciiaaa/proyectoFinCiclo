<?php
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/database.php';

configureCors();

$db = new Database();
$conn = $db->getConnection();

try {
    $query = "SELECT w.WorkshopID, w.Name, w.Address, w.Phone, w.Description 
              FROM Workshops w";
    
    $result = $conn->query($query);
    
    if ($result) {
        $workshops = [];
        while ($row = $result->fetch_assoc()) {
            $workshops[] = $row;
        }
        
        echo json_encode([
            'success' => true,
            'workshops' => $workshops
        ]);
    } else {
        throw new Exception("Error al obtener los talleres");
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
?>
