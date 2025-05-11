<?php
// Headers CORS
header("Access-Control-Allow-Origin: http://localhost:4200");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

// Manejar preflight OPTIONS
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Validaciones y configuración
define('MIN_PASSWORD_LENGTH', 6);

// Conexión a la base de datos
$conn = new mysqli("localhost", "hmi", "hmi", "AutoCareHub");
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Error de conexión al servidor"]);
    exit();
}

if ($_SERVER["REQUEST_METHOD"] === "POST") {
    $input = json_decode(file_get_contents("php://input"), true);

    // Validar datos recibidos
    $email = filter_var($input["email"] ?? '', FILTER_VALIDATE_EMAIL);
    $fullName = trim($input["fullName"] ?? '');
    $password = $input["password"] ?? '';
    $notificationType = $input["notificationType"] ?? '';
    $contactValue = trim($input["contactValue"] ?? '');

    // Validaciones
    $errors = [];

    if (!$email) {
        $errors[] = "Email inválido";
    }

    if (strlen($fullName) < 3) {
        $errors[] = "El nombre debe tener al menos 3 caracteres";
    }

    if (strlen($password) < MIN_PASSWORD_LENGTH) {
        $errors[] = "La contraseña debe tener al menos " . MIN_PASSWORD_LENGTH . " caracteres";
    }

    $allowedTypes = ['SMS', 'Telegram', 'WhatsApp'];
    if (!in_array($notificationType, $allowedTypes)) {
        $errors[] = "Tipo de notificación inválido";
    }
    if (empty($contactValue)) {
        $errors[] = "El valor de contacto es obligatorio";
    }

    if (!empty($errors)) {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "message" => "Errores de validación",
            "errors" => $errors
        ]);
        exit();
    }

    // Verificar si el email ya existe
    $stmt = $conn->prepare("SELECT UserId FROM Users WHERE Email = ?");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows > 0) {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "message" => "El email ya está registrado"
        ]);
        exit();
    }

    // Hash de la contraseña
    $passwordHash = password_hash($password, PASSWORD_DEFAULT);

    // Insertar nuevo usuario
    $stmt = $conn->prepare("INSERT INTO Users (Email, FullName, Password) VALUES (?, ?, ?)");
    $stmt->bind_param("sss", $email, $fullName, $passwordHash);

    if ($stmt->execute()) {
        $userId = $stmt->insert_id;

        // Insertar preferencia de notificación
        $stmtPref = $conn->prepare("INSERT INTO NotificationPreferences (UserID, NotificationType, ContactValue, IsActive) VALUES (?, ?, ?, true)");
        $stmtPref->bind_param("iss", $userId, $notificationType, $contactValue);
        if (!$stmtPref->execute()) {
            http_response_code(500);
            echo json_encode([
                "success" => false,
                "message" => "Usuario creado, pero error al guardar preferencia de notificación"
            ]);
            $stmtPref->close();
            exit();
        }
        $stmtPref->close();

        http_response_code(201);
        echo json_encode([
            "success" => true,
            "message" => "Usuario registrado correctamente",
            "user" => [
                "id" => $userId,
                "name" => $fullName,
                "email" => $email,
                "notificationType" => $notificationType,
                "contactValue" => $contactValue
            ]
        ]);
    } else {
        http_response_code(500);
        echo json_encode([
            "success" => false,
            "message" => "Error al registrar el usuario"
        ]);
    }

    $stmt->close();
    exit();
}

http_response_code(405);
echo json_encode(["success" => false, "message" => "Método no permitido"]);
$conn->close();
?>