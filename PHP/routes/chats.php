<?php
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../controllers/ChatController.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/Logger.php';

configureCors();

session_start();

if (!isset($_SESSION['user']['id']) || !isset($_SESSION['user']['role'])) {
    Logger::warning("Intento de acceso no autorizado a chats.php");
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'No autorizado']);
    exit();
}

$db = new Database();
$conn = $db->getConnection();

try {
    $controller = new ChatController(
        $conn, 
        $_SESSION['user']['id'],
        $_SESSION['user']['role']
    );

    switch ($_SERVER['REQUEST_METHOD']) {
        case 'POST':
            $input = json_decode(file_get_contents("php://input"), true);
            if (!$input) {
                Logger::error("Error al procesar datos de entrada en chats.php");
                throw new Exception("Error al procesar los datos de entrada");
            }
            
            if (!isset($input['action'])) {
                Logger::warning("Intento de POST sin acción especificada en chats.php");
                throw new Exception("Falta el parámetro 'action'");
            }
            
            Logger::info("Procesando acción de chat", [
                'action' => $input['action'],
                'userId' => $_SESSION['user']['id'],
                'role' => $_SESSION['user']['role']
            ]);
            
            switch ($input['action']) {
                case 'iniciar_chat':
                    Logger::info("Iniciando nuevo chat", [
                        'workshopId' => $input['workshop_id'] ?? null
                    ]);
                    $controller->iniciarChat($input);
                    break;
                case 'enviar_mensaje':
                    Logger::info("Enviando mensaje en chat", [
                        'chatId' => $input['chat_id'] ?? null
                    ]);
                    $controller->enviarMensaje($input);
                    break;
                default:
                    Logger::warning("Acción inválida en chats.php", [
                        'action' => $input['action']
                    ]);
                    throw new Exception("Acción no válida");
            }
            break;
            
        case 'GET':
            if (isset($_GET['chat_id'])) {
                $chatId = filter_var($_GET['chat_id'], FILTER_VALIDATE_INT);
                if (!$chatId) {
                    Logger::warning("ID de chat inválido proporcionado");
                    throw new Exception("ID de chat inválido");
                }
                Logger::info("Obteniendo mensajes de chat", ['chatId' => $chatId]);
                $controller->obtenerMensajes($chatId);
            } else {
                Logger::info("Obteniendo lista de chats del usuario", [
                    'userId' => $_SESSION['user']['id']
                ]);
                $controller->obtenerChats();
            }
            break;
            
        default:
            Logger::warning("Método no permitido en chats.php", [
                'method' => $_SERVER['REQUEST_METHOD']
            ]);
            throw new Exception("Método no permitido");
    }
} catch (Exception $e) {
    Logger::error("Error en chats.php: " . $e->getMessage());
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
}
?>
