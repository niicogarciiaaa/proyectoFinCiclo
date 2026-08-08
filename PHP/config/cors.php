<?php
require_once __DIR__ . '/Logger.php';

function configureCors() {
    $allowedOrigins = ['http://localhost', 'http://localhost:4200'];
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';

    if (in_array($origin, $allowedOrigins)) {
        header("Access-Control-Allow-Origin: $origin");
        Logger::info("CORS acceso permitido para origen: " . $origin);
    } else {
        Logger::warning("Intento de acceso CORS bloqueado para origen: " . $origin);
    }

    header("Access-Control-Allow-Credentials: true");
    header("Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, content-type");
    header("Content-Type: application/json; charset=UTF-8");

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit();
    }
}
?>