<?php
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../controllers/AppointmentController.php';
require_once __DIR__ . '/../config/database.php';

configureCors();

session_start();

// Verificar autenticación
if (!isset($_SESSION['user']['id']) || !isset($_SESSION['user']['role'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'No autorizado']);
    exit();
}

// Inicializar la base de datos y el controlador
$db = new Database();
$conn = $db->getConnection();

if (!$conn) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error de conexión a la base de datos']);
    exit();
}

try {
    $controller = new AppointmentController(
        $conn, 
        $_SESSION['user']['id'],
        $_SESSION['user']['role']
    );

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents("php://input"), true);
        
        if (!isset($input['accion'])) {
            throw new Exception("Falta el parámetro 'accion'");
        }

        switch ($input['accion']) {
            case 'consultar_semana':
                $controller->consultarSemana($input);
                break;
            case 'crear':
                $controller->crear($input);
                break;
            case 'ver_citas_taller':
                $controller->verCitasTaller();
                break;
            default:
                throw new Exception("Acción no válida");
        }
    } else {
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