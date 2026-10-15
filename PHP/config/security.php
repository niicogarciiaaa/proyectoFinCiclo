<?php
require_once __DIR__ . '/Logger.php';

/**
 * Utilidades de seguridad para las llamadas NUEVAS de la API.
 * (Las llamadas originales no se modifican.)
 */

/** Cabeceras HTTP de endurecimiento básico para respuestas JSON. */
function applySecurityHeaders() {
    header("X-Content-Type-Options: nosniff");
    header("X-Frame-Options: DENY");
    header("Referrer-Policy: same-origin");
    header("Cache-Control: no-store");
}

/**
 * Protección CSRF para peticiones POST con cookie de sesión.
 *
 * Un formulario HTML de otra web solo puede enviar POST "simples"
 * (form-urlencoded, multipart o text/plain). Exigiendo Content-Type
 * application/json, el navegador obliga a hacer una petición preflight
 * de CORS, que solo superan los orígenes permitidos en cors.php. Así una
 * web maliciosa no puede lanzar acciones con la sesión del usuario.
 */
function requireJsonRequest() {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        return;
    }
    $contentType = strtolower($_SERVER['CONTENT_TYPE'] ?? ($_SERVER['HTTP_CONTENT_TYPE'] ?? ''));
    if (strpos($contentType, 'application/json') !== 0) {
        Logger::warning("Petición POST rechazada por Content-Type no JSON (posible CSRF)", [
            'contentType' => $contentType,
            'uri'         => $_SERVER['REQUEST_URI'] ?? '',
        ]);
        http_response_code(415);
        echo json_encode(['success' => false, 'message' => 'Content-Type no soportado: se requiere application/json']);
        exit();
    }
}

/**
 * Lee el cuerpo JSON de la petición. Devuelve siempre un array (vacío si el
 * cuerpo no es JSON válido), evitando avisos al acceder a claves.
 */
function readJsonBody() {
    $input = json_decode(file_get_contents("php://input"), true);
    return is_array($input) ? $input : [];
}
?>
