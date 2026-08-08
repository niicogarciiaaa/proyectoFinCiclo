<?php
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../controllers/VerifactuController.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/Logger.php';

configureCors();

session_start();

if (!isset($_SESSION['user']['id']) || !isset($_SESSION['user']['role'])) {
    Logger::warning("Intento de acceso no autorizado a verifactu.php");
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'No autorizado']);
    exit();
}

$db = new Database();
$conn = $db->getConnection();

if (!$conn) {
    Logger::error("Error de conexión a la base de datos en verifactu.php");
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error de conexión a la base de datos']);
    exit();
}

try {
    $controller = new VerifactuController(
        $conn,
        $_SESSION['user']['id'],
        $_SESSION['user']['role']
    );

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents("php://input"), true);

        if (!isset($input['accion'])) {
            throw new Exception("Falta el parámetro 'accion'");
        }

        Logger::info("Procesando acción VeriFactu", [
            'accion' => $input['accion'],
            'userId' => $_SESSION['user']['id'],
        ]);

        switch ($input['accion']) {
            case 'obtener_emisor':
                $controller->obtenerEmisor();
                break;
            case 'guardar_emisor':
                $controller->guardarEmisor($input);
                break;
            case 'generar':
                $controller->generar($input);
                break;
            case 'obtener':
                $controller->obtener($input);
                break;
            case 'verificar_cadena':
                $controller->verificarCadena();
                break;
            default:
                throw new Exception("Acción no válida");
        }
    } else {
        throw new Exception("Método no permitido");
    }
} catch (Exception $e) {
    Logger::error("Error en verifactu.php: " . $e->getMessage());
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>
