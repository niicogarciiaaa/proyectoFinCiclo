<?php
header("Access-Control-Allow-Origin: http://localhost:4200");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

session_start();

if (!isset($_SESSION['user']['id']) || !isset($_SESSION['user']['role'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'No autorizado']);
    exit();
}

require_once __DIR__ . '/../controllers/ChatController.php';
require_once __DIR__ . '/../config/database.php';

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
                throw new Exception("Error al procesar los datos de entrada");
            }
            
            if (!isset($input['action'])) {
                throw new Exception("Falta el parámetro 'action'");
            }
            
            switch ($input['action']) {
                case 'iniciar_chat':
                    $controller->iniciarChat($input);
                    break;
                case 'enviar_mensaje':
                    $controller->enviarMensaje($input);
                    break;
                default:
                    throw new Exception("Acción no válida");
            }
            break;
            
        case 'GET':
            if (isset($_GET['chat_id'])) {
                $chatId = filter_var($_GET['chat_id'], FILTER_VALIDATE_INT);
                if (!$chatId) {
                    throw new Exception("ID de chat inválido");
                }
                $controller->obtenerMensajes($chatId);
            } else {
                $controller->obtenerChats();
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
