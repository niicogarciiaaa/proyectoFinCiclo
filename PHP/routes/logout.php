<?php
/**
 * Cierre de sesión (llamada nueva).
 * Destruye la sesión PHP en el servidor y borra sus cookies, para que
 * "Cerrar sesión" en la web invalide también la sesión del backend.
 */
require_once __DIR__ . '/../config/cors.php';
require_once __DIR__ . '/../config/security.php';
require_once __DIR__ . '/../config/Logger.php';

configureCors();
applySecurityHeaders();
requireJsonRequest();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Método no permitido']);
    exit();
}

session_start();
$userId = $_SESSION['user']['id'] ?? null;

$_SESSION = [];
if (ini_get('session.use_cookies')) {
    $p = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
}
session_destroy();
// Cookie informativa que crea login.php.
setcookie('user_role', '', time() - 42000, '/');

Logger::auth("Cierre de sesión", ['userId' => $userId]);
echo json_encode(['success' => true, 'message' => 'Sesión cerrada']);
?>
