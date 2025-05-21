<?php
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../controllers/InvoiceController.php';
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

if (!$conn) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error de conexión a la base de datos']);
    exit();
}

try {
    $controller = new InvoiceController(
        $conn, 
        $_SESSION['user']['id'],
        $_SESSION['user']['role']
    );

    switch ($_SERVER['REQUEST_METHOD']) {
        case 'POST':
            $input = json_decode(file_get_contents("php://input"), true);
            $controller->crear($input);
            break;
            
        case 'GET':
            $action = $_GET['action'] ?? 'listar';
            switch ($action) {
                case 'estadisticas':
                    $controller->obtenerEstadisticas();
                    break;
                case 'buscar':
                    $controller->buscarFacturas();
                    break;
                default:
                    $controller->listar();
                    break;
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