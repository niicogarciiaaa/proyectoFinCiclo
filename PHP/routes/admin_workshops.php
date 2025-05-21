<?php
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../controllers/WorkshopController.php';
require_once __DIR__ . '/../config/database.php';

configureCors();

session_start();

if (!isset($_SESSION['user']['id']) || !isset($_SESSION['user']['role'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'No autorizado']);
    exit();
}

$db = new Database();
$conn = $db->getConnection();

try {
    $controller = new WorkshopController(
        $conn, 
        $_SESSION['user']['id'],
        $_SESSION['user']['role']
    );

    switch ($_SERVER['REQUEST_METHOD']) {
        case 'POST':
            // Crear nuevo taller
            $input = json_decode(file_get_contents("php://input"), true);
            if (!$input) {
                throw new Exception("Error al procesar los datos de entrada");
            }
            
            $controller->createWorkshop($input);
            break;
            
        case 'PUT':
            // Actualizar información del taller
            $input = json_decode(file_get_contents("php://input"), true);
            if (!$input) {
                throw new Exception("Error al procesar los datos de entrada");
            }
            
            $controller->updateWorkshop($input);
            break;
            
        case 'GET':
            // Listar todos los talleres
            $stmt = $conn->query("SELECT w.*, u.Email, u.FullName 
                                FROM Workshops w 
                                JOIN Users u ON w.UserID = u.UserID");
            
            if ($stmt) {
                $workshops = [];
                while ($row = $stmt->fetch_assoc()) {
                    $workshops[] = $row;
                }
                
                echo json_encode([
                    'success' => true,
                    'workshops' => $workshops
                ]);
            } else {
                throw new Exception("Error al obtener los talleres");
            }
            break;
            
        default:
            throw new Exception("Método no permitido");
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
?>
