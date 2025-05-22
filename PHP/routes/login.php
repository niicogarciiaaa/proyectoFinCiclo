<?php
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../controllers/AuthController.php';

configureCors();

$controller = new AuthController();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents("php://input"), true);
    $controller->login($input);

    // Establecer una cookie para recordar el rol del usuario
    if (isset($_SESSION['user']['role'])) {
        setcookie('user_role', $_SESSION['user']['role'], time() + (86400 * 30), "/"); // Expira en 30 días
    }
} else {
    http_response_code(405);
    echo json_encode(["success" => false, "message" => "Método no permitido"]);
}
