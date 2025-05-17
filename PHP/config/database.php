<?php
class Database {
    private $host = "localhost";
    private $db_name = "AutoCareHub";
    private $username = "hmi";
    private $password = "hmi";
    public $conn;

    public function getConnection() {
        $this->conn = null;
        $this->conn = new mysqli($this->host, $this->username, $this->password, $this->db_name);
        if ($this->conn->connect_error) {
            return null;
        }
        return $this->conn;
    }
}
