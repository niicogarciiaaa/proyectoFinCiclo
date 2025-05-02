<?php
// Permitir solicitudes desde cualquier origen durante el desarrollo
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

// Manejar solicitudes preflight OPTIONS
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}
session_start();

// Configuración
define('MAX_LOGIN_ATTEMPTS', 5);
define('LOGIN_TIMEOUT', 1800); // 30 minutos en segundos
define('MIN_PASSWORD_LENGTH', 6); // Longitud mínima de contraseña

// Conexión a la base de datos
$conn = new mysqli("localhost", "hmi", "hmi", "AutoCareHub");
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Error de conexión al servidor"]);
    exit();
}

if ($_SERVER["REQUEST_METHOD"] === "POST") {
    $input = json_decode(file_get_contents("php://input"), true);
    $email = filter_var($input["email"] ?? '', FILTER_VALIDATE_EMAIL);
    $password = $input["password"] ?? '';

    // Validación básica del email
    if (!$email) {
        http_response_code(400);
        echo json_encode([
            "success" => false, 
            "message" => "El formato del email no es válido"
        ]);
        exit();
    }

    // Validación de la longitud de la contraseña
    if (strlen($password) < MIN_PASSWORD_LENGTH) {
        http_response_code(400);
        echo json_encode([
            "success" => false, 
            "message" => "La contraseña debe tener al menos " . MIN_PASSWORD_LENGTH . " caracteres"
        ]);
        exit();
    }

    // Verificar intentos de inicio de sesión
    if (isset($_SESSION['login_attempts'][$email]) && 
        $_SESSION['login_attempts'][$email]['attempts'] >= MAX_LOGIN_ATTEMPTS && 
        time() - $_SESSION['login_attempts'][$email]['time'] < LOGIN_TIMEOUT) {
        
        $tiempoRestante = ceil((LOGIN_TIMEOUT - (time() - $_SESSION['login_attempts'][$email]['time'])) / 60);
        
        http_response_code(429);
        echo json_encode([
            "success" => false,
            "message" => "Demasiados intentos. Por favor, espere " . $tiempoRestante . " minutos"
        ]);
        exit();
    }

    // Verificar usuario y contraseña
    $stmt = $conn->prepare("SELECT UserId, Password, FullName, Email, Role FROM Users WHERE Email = ?");
    if (!$stmt) {
        http_response_code(500);
        echo json_encode([
            "success" => false,
            "message" => "Error en la preparación de la consulta"
        ]);
        exit();
    }

    $stmt->bind_param("s", $email);
    if (!$stmt->execute()) {
        http_response_code(500);
        echo json_encode([
            "success" => false,
            "message" => "Error al ejecutar la consulta"
        ]);
        exit();
    }

    $result = $stmt->get_result();
    $user = $result->fetch_assoc();

    // Verificar si el usuario existe
    if (!$user) {
        http_response_code(401);
        echo json_encode([
            "success" => false,
            "message" => "Usuario no encontrado"
        ]);
        exit();
    }

    // Verificar la contraseña
    if (!password_verify($password, $user['Password'])) {
        // Incrementar intentos fallidos
        if (!isset($_SESSION['login_attempts'][$email])) {
            $_SESSION['login_attempts'][$email] = [
                'attempts' => 1,
                'time' => time()
            ];
        } else {
            $_SESSION['login_attempts'][$email]['attempts']++;
            $_SESSION['login_attempts'][$email]['time'] = time();
        }

        http_response_code(401);
        echo json_encode([
            "success" => false,
            "message" => "Contraseña incorrecta",
            "attempts_left" => MAX_LOGIN_ATTEMPTS - $_SESSION['login_attempts'][$email]['attempts']
        ]);
        exit();
    }

    // Si llegamos aquí, el login es exitoso
    // Reiniciar intentos de inicio de sesión
    unset($_SESSION['login_attempts'][$email]);

    // Guardar información en la sesión
    $_SESSION['user'] = [
        'id' => $user['UserId'],
        'email' => $user['Email'],
        'name' => $user['FullName'],
        'last_activity' => time(),
        'role' => isset($user['Role']) ? $user['Role'] : 'default' // Asegurarse de que 'Role' esté disponible
    ];

    // Devolver respuesta exitosa
    echo json_encode([
        "success" => true,
        "user" => [
            "name" => $user['FullName'],
            "email" => $user['Email'],
            "role" => $_SESSION['user']['role'] // Enviar el valor correcto del rol
        ]
    ]);

    $stmt->close();
    exit();
}

http_response_code(405);
echo json_encode(["success" => false, "message" => "Método no permitido"]);
$conn->close();
?>
