<?php
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../controllers/AuthController.php';
require_once __DIR__ . '/../config/Logger.php';

configureCors();

$controller = new AuthController();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents("php://input"), true);
    Logger::auth("Intento de inicio de sesión", [
        'email' => $input['email'] ?? 'no proporcionado'
    ]);

    $controller->login($input);

    if (isset($_SESSION['user']['role'])) {
        setcookie('user_role', $_SESSION['user']['role'], time() + (86400 * 30), "/");
        Logger::auth("Inicio de sesión exitoso", [
            'userId' => $_SESSION['user']['id'],
            'role' => $_SESSION['user']['role']
        ]);
    } else {
        Logger::warning("Inicio de sesión fallido", [
            'email' => $input['email'] ?? 'no proporcionado'
        ]);
    }
} else {
    Logger::warning("Método no permitido en login.php", [
        'method' => $_SERVER['REQUEST_METHOD']
    ]);
    http_response_code(405);
    echo json_encode(["success" => false, "message" => "Método no permitido"]);
}
