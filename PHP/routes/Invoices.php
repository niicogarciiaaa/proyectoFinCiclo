<?php
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../controllers/InvoiceController.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/Logger.php';

configureCors();

session_start();

if (!isset($_SESSION['user']['id']) || !isset($_SESSION['user']['role'])) {
    Logger::warning("Intento de acceso no autorizado a Invoices.php");
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'No autorizado']);
    exit();
}

$db = new Database();
$conn = $db->getConnection();

if (!$conn) {
    Logger::error("Error de conexión a la base de datos en Invoices.php");
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
            Logger::info("Creando nueva factura", [
                'userId' => $_SESSION['user']['id'],
                'role' => $_SESSION['user']['role'],
                'appointmentId' => $input['appointment_id'] ?? null
            ]);
            $controller->crear($input);
            break;
            
        case 'GET':
            $action = $_GET['action'] ?? 'listar';
            Logger::info("Procesando acción de factura", [
                'action' => $action,
                'userId' => $_SESSION['user']['id'],
                'role' => $_SESSION['user']['role']
            ]);
            
            switch ($action) {
                case 'estadisticas':
                    $controller->obtenerEstadisticas();
                    break;
                case 'buscar':
                    Logger::info("Búsqueda de facturas", [
                        'startDate' => $_GET['start_date'] ?? null,
                        'endDate' => $_GET['end_date'] ?? null,
                        'estado' => $_GET['estado'] ?? null
                    ]);
                    $controller->buscarFacturas();
                    break;
                default:
                    $controller->listar();
                    break;
            }
            break;
            
        default:
            Logger::warning("Método no permitido en Invoices.php", [
                'method' => $_SERVER['REQUEST_METHOD']
            ]);
            throw new Exception("Método no permitido");
    }
} catch (Exception $e) {
    Logger::error("Error en Invoices.php: " . $e->getMessage());
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
?>