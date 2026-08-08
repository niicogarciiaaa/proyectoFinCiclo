<?php
class User {
    private $conn;
    private $table = 'Users';
    public function __construct($db) {
        $this->conn = $db;

    }

    public function findByEmail($email) {
        $stmt = $this->conn->prepare("SELECT UserId, Password, FullName, Email, Role FROM Users WHERE Email = ?");
        if (!$stmt) return false;

        $stmt->bind_param("s", $email);
        if (!$stmt->execute()) return false;

        $result = $stmt->get_result();
        return $result->fetch_assoc();
    }
    public function create($email, $fullName, $password, $notificationType, $contactValue) {
        try {
            $this->conn->begin_transaction();

            // Verificar si el email existe
            if ($this->emailExists($email)) {
                throw new Exception("El email ya está registrado");
            }

            // Hash de la contraseña
            $passwordHash = password_hash($password, PASSWORD_DEFAULT);

            // Insertar usuario
            $stmt = $this->conn->prepare(
                "INSERT INTO {$this->table} (Email, FullName, Password) VALUES (?, ?, ?)"
            );
            $stmt->bind_param("sss", $email, $fullName, $passwordHash);

            if (!$stmt->execute()) {
                throw new Exception("Error al registrar el usuario");
            }

            $userId = $stmt->insert_id;

            // Insertar preferencia de notificación
            $stmtPref = $this->conn->prepare(
                "INSERT INTO NotificationPreferences (UserID, NotificationType, ContactValue, IsActive) 
                 VALUES (?, ?, ?, true)"
            );
            $stmtPref->bind_param("iss", $userId, $notificationType, $contactValue);

            if (!$stmtPref->execute()) {
                throw new Exception("Error al guardar preferencia de notificación");
            }

            $this->conn->commit();
            return [
                'id' => $userId,
                'name' => $fullName,
                'email' => $email,
                'notificationType' => $notificationType,
                'contactValue' => $contactValue
            ];

        } catch (Exception $e) {
            $this->conn->rollback();
            throw $e;
        }
    }

    private function emailExists($email) {
        $stmt = $this->conn->prepare("SELECT UserId FROM {$this->table} WHERE Email = ?");
        $stmt->bind_param("s", $email);
        $stmt->execute();
        return $stmt->get_result()->num_rows > 0;
    }
}
