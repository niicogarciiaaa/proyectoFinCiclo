<?php
require_once __DIR__ . '/../models/User.php';
require_once __DIR__ . '/../config/database.php';

class AuthController {
    private $conn;
    private $userModel;
    private const MAX_LOGIN_ATTEMPTS = 5;
    private const LOGIN_TIMEOUT = 1800;
    private const MIN_PASSWORD_LENGTH = 6;

    public function __construct() {
        session_start();
        $db = new Database();
$this->conn = $db->getConnection();

        $this->userModel = new User($this->conn);
    }

    public function login($input) {
        define('MAX_LOGIN_ATTEMPTS', 5);
        define('LOGIN_TIMEOUT', 1800);
        define('MIN_PASSWORD_LENGTH', 6);

        $email = filter_var($input["email"] ?? '', FILTER_VALIDATE_EMAIL);
        $password = $input["password"] ?? '';

        if (!$email) {
            return $this->response(400, "El formato del email no es válido");
        }

        if (strlen($password) < MIN_PASSWORD_LENGTH) {
            return $this->response(400, "La contraseña debe tener al menos " . MIN_PASSWORD_LENGTH . " caracteres");
        }

        if (isset($_SESSION['login_attempts'][$email]) &&
            $_SESSION['login_attempts'][$email]['attempts'] >= MAX_LOGIN_ATTEMPTS &&
            time() - $_SESSION['login_attempts'][$email]['time'] < LOGIN_TIMEOUT) {
            
            $tiempoRestante = ceil((LOGIN_TIMEOUT - (time() - $_SESSION['login_attempts'][$email]['time'])) / 60);
            return $this->response(429, "Demasiados intentos. Por favor, espere $tiempoRestante minutos");
        }

        $user = $this->userModel->findByEmail($email);
        if (!$user) {
            return $this->response(401, "Usuario no encontrado");
        }

        if (!password_verify($password, $user['Password'])) {
            $_SESSION['login_attempts'][$email]['attempts'] = ($_SESSION['login_attempts'][$email]['attempts'] ?? 0) + 1;
            $_SESSION['login_attempts'][$email]['time'] = time();
            return $this->response(401, "Contraseña incorrecta", [
                "attempts_left" => MAX_LOGIN_ATTEMPTS - $_SESSION['login_attempts'][$email]['attempts']
            ]);
        }

        unset($_SESSION['login_attempts'][$email]);

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
    public function register($input) {
        try {
            // Validar datos recibidos
            $validationErrors = $this->validateRegistrationData($input);
            if (!empty($validationErrors)) {
                return $this->response(400, "Errores de validación", ['errors' => $validationErrors]);
            }

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

    private function response($code, $message, $data = []) {
        http_response_code($code);
        echo json_encode(array_merge([
            "success" => $code < 400,
            "message" => $message
        ], $data ? ["user" => $data] : []));
    }
    private function validateRegistrationData($input) {
        $errors = [];
        
        $email = filter_var($input["email"] ?? '', FILTER_VALIDATE_EMAIL);
        $fullName = trim($input["fullName"] ?? '');
        $password = $input["password"] ?? '';
        $notificationType = $input["notificationType"] ?? '';
        $contactValue = trim($input["contactValue"] ?? '');

        if (!$email) {
            $errors[] = "Email inválido";
        }

        if (strlen($fullName) < 3) {
            $errors[] = "El nombre debe tener al menos 3 caracteres";
        }

        if (strlen($password) < self::MIN_PASSWORD_LENGTH) {
            $errors[] = "La contraseña debe tener al menos " . self::MIN_PASSWORD_LENGTH . " caracteres";
        }

        $allowedTypes = ['SMS', 'Telegram', 'WhatsApp'];
        if (!in_array($notificationType, $allowedTypes)) {
            $errors[] = "Tipo de notificación inválido";
        }

        if (empty($contactValue)) {
            $errors[] = "El valor de contacto es obligatorio";
        }

        return $errors;
    }
}
