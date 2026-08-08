<?php
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../controllers/AuthController.php';
require_once __DIR__ . '/../config/Logger.php';

configureCors();

$controller = new AuthController();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents("php://input"), true);
    
    Logger::info("Intento de registro de nuevo usuario", [
        'email' => $input['email'] ?? 'no proporcionado',
        'role' => $input['role'] ?? 'no especificado'
    ]);
    
    $controller->register($input);
} else {
    Logger::warning("Método no permitido en register.php", [
        'method' => $_SERVER['REQUEST_METHOD']
    ]);
    http_response_code(405);
    echo json_encode(["success" => false, "message" => "Método no permitido"]);
}