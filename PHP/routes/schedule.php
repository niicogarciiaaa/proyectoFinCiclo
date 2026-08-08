<?php
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../controllers/ScheduleController.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/Logger.php';

configureCors();

session_start();

// Verificar autenticación
if (!isset($_SESSION['user']['id']) || !isset($_SESSION['user']['role'])) {
    Logger::warning("Intento de acceso no autorizado a schedule.php");
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'No autorizado']);
    exit();
}

// Inicializar la base de datos y el controlador
$db = new Database();
$conn = $db->getConnection();

if (!$conn) {
    Logger::error("Error de conexión a la base de datos en schedule.php");
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error de conexión a la base de datos']);
    exit();
}

try {
    $controller = new ScheduleController(
        $conn,
        $_SESSION['user']['id'],
        $_SESSION['user']['role']
    );

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents("php://input"), true);

        if (!isset($input['accion'])) {
            Logger::warning("Intento de POST sin acción especificada en schedule.php");
            throw new Exception("Falta el parámetro 'accion'");
        }

        Logger::info("Procesando acción de agenda", [
            'accion' => $input['accion'],
            'userId' => $_SESSION['user']['id'],
            'role'   => $_SESSION['user']['role']
        ]);

        switch ($input['accion']) {
            case 'obtener_config':
                $controller->obtenerConfig();
                break;
            case 'guardar_config':
                $controller->guardarConfig($input);
                break;
            case 'crear_servicio':
                $controller->crearServicio($input);
                break;
            case 'actualizar_servicio':
                $controller->actualizarServicio($input);
                break;
            case 'eliminar_servicio':
                $controller->eliminarServicio($input);
                break;
            case 'listar_servicios':
                $controller->listarServicios($input);
                break;
            case 'disponibilidad':
                $controller->disponibilidad($input);
                break;
            case 'crear_cita':
                $controller->crearCita($input);
                break;
            case 'cambiar_estado':
                $controller->cambiarEstado($input);
                break;
            case 'mis_citas':
                $controller->misCitas();
                break;
            case 'cancelar':
                $controller->cancelar($input);
                break;
            case 'citas_taller':
                $controller->citasTaller();
                break;
            default:
                Logger::warning("Acción inválida en schedule.php", ['accion' => $input['accion']]);
                throw new Exception("Acción no válida");
        }
    } else {
        Logger::warning("Método no permitido en schedule.php", ['method' => $_SERVER['REQUEST_METHOD']]);
        throw new Exception("Método no permitido");
    }
} catch (Exception $e) {
    Logger::error("Error en schedule.php: " . $e->getMessage());
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
?>
