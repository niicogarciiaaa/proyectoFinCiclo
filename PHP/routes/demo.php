<?php
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/security.php';
require_once __DIR__ . '/../controllers/DemoController.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/Logger.php';

configureCors();
applySecurityHeaders();
requireJsonRequest();

session_start();

if (!isset($_SESSION['user']['id']) || !isset($_SESSION['user']['role'])) {
    Logger::warning("Intento de acceso no autorizado a demo.php");
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'No autorizado']);
    exit();
}

$db = new Database();
$conn = $db->getConnection();

if (!$conn) {
    Logger::error("Error de conexión a la base de datos en demo.php");
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error de conexión a la base de datos']);
    exit();
}

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception("Método no permitido");
    }

    $controller = new DemoController($conn, $_SESSION['user']['id'], $_SESSION['user']['role']);
    $input = readJsonBody();

    if (!isset($input['accion'])) {
        throw new Exception("Falta el parámetro 'accion'");
    }

    Logger::info("Procesando acción del modo demostración", [
        'accion' => $input['accion'],
        'userId' => $_SESSION['user']['id'],
    ]);

    switch ($input['accion']) {
        case 'estado':
            $controller->estado();
            break;
        case 'crear':
            $controller->crear();
            break;
        case 'borrar':
            $controller->borrar();
            break;
        default:
            throw new Exception("Acción no válida");
    }
} catch (Exception $e) {
    Logger::error("Error en demo.php: " . $e->getMessage());
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>
