<?php
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/security.php';
require_once __DIR__ . '/../controllers/TrackingController.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/Logger.php';

configureCors();
applySecurityHeaders();
requireJsonRequest();

session_start();

if (!isset($_SESSION['user']['id']) || !isset($_SESSION['user']['role'])) {
    Logger::warning("Intento de acceso no autorizado a tracking.php");
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'No autorizado']);
    exit();
}

$db = new Database();
$conn = $db->getConnection();

if (!$conn) {
    Logger::error("Error de conexión a la base de datos en tracking.php");
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error de conexión a la base de datos']);
    exit();
}

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception("Método no permitido");
    }

    $controller = new TrackingController($conn, $_SESSION['user']['id'], $_SESSION['user']['role']);
    $input = readJsonBody();

    if (!isset($input['accion'])) {
        throw new Exception("Falta el parámetro 'accion'");
    }

    Logger::info("Procesando acción de seguimiento", [
        'accion' => $input['accion'],
        'userId' => $_SESSION['user']['id'],
    ]);

    switch ($input['accion']) {
        case 'etapas':
            $controller->etapas();
            break;
        case 'resumen':
            $controller->resumen();
            break;
        case 'historial':
            $controller->historial($input);
            break;
        case 'avanzar':
            $controller->avanzar($input);
            break;
        case 'deshacer':
            $controller->deshacer($input);
            break;
        default:
            throw new Exception("Acción no válida");
    }
} catch (Exception $e) {
    Logger::error("Error en tracking.php: " . $e->getMessage());
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>
