<?php
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../controllers/WorkshopController.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/Logger.php';

configureCors();

session_start();

if (!isset($_SESSION['user']['id']) || !isset($_SESSION['user']['role'])) {
    Logger::warning("Intento de acceso no autorizado a admin_workshops.php");
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
            Logger::info("Intento de crear nuevo taller", [
                'userId' => $_SESSION['user']['id'],
                'role' => $_SESSION['user']['role']
            ]);
            
            $input = json_decode(file_get_contents("php://input"), true);
            if (!$input) {
                Logger::error("Error al procesar datos de entrada para crear taller");
                throw new Exception("Error al procesar los datos de entrada");
            }
            
            $controller->createWorkshop($input);
            break;
            
        case 'PUT':
            Logger::info("Intento de actualizar taller", [
                'userId' => $_SESSION['user']['id'],
                'role' => $_SESSION['user']['role']
            ]);
            
            $input = json_decode(file_get_contents("php://input"), true);
            if (!$input) {
                Logger::error("Error al procesar datos de entrada para actualizar taller");
                throw new Exception("Error al procesar los datos de entrada");
            }
            
            $controller->updateWorkshop($input);
            break;
            
        case 'GET':
            Logger::info("Consultando lista de talleres (admin)", [
                'userId' => $_SESSION['user']['id'],
                'role' => $_SESSION['user']['role']
            ]);
            
            $stmt = $conn->query("SELECT w.*, u.Email, u.FullName 
                                FROM Workshops w 
                                JOIN Users u ON w.UserID = u.UserID");
            
            if ($stmt) {
                $workshops = [];
                while ($row = $stmt->fetch_assoc()) {
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
                Logger::error("Error al obtener la lista de talleres");
                throw new Exception("Error al obtener los talleres");
            }
            break;
            
        default:
            Logger::warning("Método no permitido en admin_workshops.php", [
                'method' => $_SERVER['REQUEST_METHOD']
            ]);
            throw new Exception("Método no permitido");
    }
} catch (Exception $e) {
    Logger::error("Error en admin_workshops.php: " . $e->getMessage());
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
?>
