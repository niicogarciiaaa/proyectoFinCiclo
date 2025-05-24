<?php
// Importar las dependencias necesarias para el controlador de autenticación
require_once __DIR__ . '/../models/User.php';
require_once __DIR__ . '/../config/database.php';

class AuthController {
    private $conn; 
    private $userModel; // Modelo de usuario para interactuar con la base de datos
    private const MIN_PASSWORD_LENGTH = 6;

    public function __construct() {
        session_start(); // Iniciar la sesión
        $db = new Database();
        $this->conn = $db->getConnection(); // Obtener la conexión a la base de datos

        $this->userModel = new User($this->conn); // Inicializar el modelo de usuario
    }

    // Método para manejar el inicio de sesión
    public function login($input) {
        define('MAX_LOGIN_ATTEMPTS', 5); // Máximo número de intentos de inicio de sesión
        define('LOGIN_TIMEOUT', 1800); // Tiempo de espera en segundos tras demasiados intentos fallidos
        define('MIN_PASSWORD_LENGTH', 6); // Longitud mínima de la contraseña

        // Validar el email y la contraseña proporcionados
        $email = filter_var($input["email"] ?? '', FILTER_VALIDATE_EMAIL);
        $password = $input["password"] ?? '';

        if (!$email) {
            return $this->response(400, "El formato del email no es válido");
        }

        if (strlen($password) < MIN_PASSWORD_LENGTH) {
            return $this->response(400, "La contraseña debe tener al menos " . MIN_PASSWORD_LENGTH . " caracteres");
        }

        // Verificar si el usuario ha excedido el número de intentos permitidos
        if (isset($_SESSION['login_attempts'][$email]) &&
            $_SESSION['login_attempts'][$email]['attempts'] >= MAX_LOGIN_ATTEMPTS &&
            time() - $_SESSION['login_attempts'][$email]['time'] < LOGIN_TIMEOUT) {
            
            $tiempoRestante = ceil((LOGIN_TIMEOUT - (time() - $_SESSION['login_attempts'][$email]['time'])) / 60);
            return $this->response(429, "Demasiados intentos. Por favor, espere $tiempoRestante minutos");
        }

        // Buscar al usuario en la base de datos
        $user = $this->userModel->findByEmail($email);
        if (!$user) {
            return $this->response(401, "Usuario no encontrado");
        }

        // Verificar la contraseña
        if (!password_verify($password, $user['Password'])) {
            $_SESSION['login_attempts'][$email]['attempts'] = ($_SESSION['login_attempts'][$email]['attempts'] ?? 0) + 1;
            $_SESSION['login_attempts'][$email]['time'] = time();
            return $this->response(401, "Contraseña incorrecta", [
                "attempts_left" => MAX_LOGIN_ATTEMPTS - $_SESSION['login_attempts'][$email]['attempts']
            ]);
        }

        // Restablecer los intentos fallidos si el inicio de sesión es exitoso
        unset($_SESSION['login_attempts'][$email]);

        // Guardar los datos del usuario en la sesión
        $_SESSION['user'] = [
            'id' => $user['UserId'],
            'email' => $user['Email'],
            'name' => $user['FullName'],
            'last_activity' => time(),
            'role' => $user['Role'] ?? 'default'
        ];

        return $this->response(200, "Login exitoso", [
            "id" => $user['UserId'],
            "name" => $user['FullName'],
            "email" => $user['Email'],
            "role" => $user['Role']
        ]);
    }

    // Método para manejar el registro de usuarios
    public function register($input) {
        try {
            // Validar los datos recibidos
            $validationErrors = $this->validateRegistrationData($input);
            if (!empty($validationErrors)) {
                return $this->response(400, "Errores de validación", ['errors' => $validationErrors]);
            }

            // Crear un nuevo usuario en la base de datos
            $user = $this->userModel->create(
                $input['email'],
                $input['fullName'],
                $input['password'],
                $input['notificationType'],
                $input['contactValue']
            );

            return $this->response(201, "Usuario registrado correctamente", $user);

        } catch (Exception $e) {
            return $this->response(500, $e->getMessage());
        }
    }

    // Método para enviar una respuesta HTTP
    private function response($code, $message, $data = []) {
        http_response_code($code); // Establecer el código de respuesta HTTP
        echo json_encode(array_merge([
            "success" => $code < 400,
            "message" => $message
        ], $data ? ["user" => $data] : []));
    }

    // Método para validar los datos de registro
    private function validateRegistrationData($input) {
        $errors = [];
        
        // Validar el email
        $email = filter_var($input["email"] ?? '', FILTER_VALIDATE_EMAIL);
        $fullName = trim($input["fullName"] ?? '');
        $password = $input["password"] ?? '';
        $notificationType = $input["notificationType"] ?? '';
        $contactValue = trim($input["contactValue"] ?? '');

        if (!$email) {
            $errors[] = "Email inválido";
        }

        // Validar el nombre completo
        if (strlen($fullName) < 3) {
            $errors[] = "El nombre debe tener al menos 3 caracteres";
        }

        // Validar la longitud de la contraseña
        if (strlen($password) < self::MIN_PASSWORD_LENGTH) {
            $errors[] = "La contraseña debe tener al menos " . self::MIN_PASSWORD_LENGTH . " caracteres";
        }

        // Validar el tipo de notificación
        $allowedTypes = ['SMS', 'Telegram', 'WhatsApp'];
        if (!in_array($notificationType, $allowedTypes)) {
            $errors[] = "Tipo de notificación inválido";
        }

        // Validar el valor de contacto
        if (empty($contactValue)) {
            $errors[] = "El valor de contacto es obligatorio";
        }

        return $errors; // Devolver los errores de validación
    }
}
