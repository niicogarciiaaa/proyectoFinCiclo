<?php
require_once __DIR__ . '/Logger.php';

class Database {
    private $host = "localhost";
    private $db_name = "AutoCareHub";
    private $username = "hmi";
    private $password = "hmi";
    public $conn;

    public function getConnection() {
        $this->conn = null;
        try {
            $this->conn = new mysqli($this->host, $this->username, $this->password, $this->db_name);
            if ($this->conn->connect_error) {
                Logger::error("Error de conexión a la base de datos: " . $this->conn->connect_error, [
                    'host' => $this->host,
                    'database' => $this->db_name
                ]);
                return null;
            }
            Logger::database("Conexión exitosa a la base de datos", [
                'host' => $this->host,
                'database' => $this->db_name
            ]);
            return $this->conn;
        } catch (Exception $e) {
            Logger::error("Excepción en la conexión a la base de datos: " . $e->getMessage());
            return null;
        }
    }
}
